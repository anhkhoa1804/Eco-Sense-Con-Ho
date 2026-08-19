"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FreshnessState } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";

export interface MapStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  freshness: FreshnessState;
}

const FRESHNESS_COLOR: Record<FreshnessState, string> = {
  live: "#1c7c42",
  recent: "#1c7c42",
  stale: "#a86400",
  offline: "#5e6670",
  never_connected: "#5e6670",
  unavailable: "#5e6670",
};

interface StationNetworkMapProps {
  stations: MapStation[];
  /**
   * `full` (default) is the homepage's interactive map. `preview` is a
   * shorter, locked-view instance for station-detail/about — real data, no
   * pan/zoom/click, so it reads as a preview rather than a second full map
   * instance (REDESIGN_SPECIFICATION.md §13). `observatory` is Monitoring's
   * own taller instance — the map is meant to be a dominant spatial anchor
   * there, not the same size as the homepage's supporting map.
   */
  variant?: "full" | "preview" | "observatory";
  /** Optional — when a marker's id matches, it renders with a highlight ring so the map can reflect an instrument-selector's current selection. */
  selectedStationId?: string;
}

const HEIGHT_CLASS: Record<NonNullable<StationNetworkMapProps["variant"]>, string> = {
  full: "h-[340px]",
  preview: "h-[260px]",
  observatory: "h-[420px] sm:h-[480px] lg:h-[560px]",
};

/**
 * Real geographic map (Leaflet + CartoDB Positron tiles — a restrained,
 * near-monochrome basemap, not the default OSM colorway) driven entirely
 * by real `stations.lat`/`lng`. Never renders a marker for a station this
 * component wasn't given real coordinates for — no placeholder pins, no
 * invented positions. Mounted client-side only; Leaflet touches `window`
 * at load time and has no SSR story.
 */
export function StationNetworkMap({ stations, variant = "full", selectedStationId }: StationNetworkMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const ringRef = useRef<import("leaflet").CircleMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const router = useRouter();
  const interactive = variant !== "preview";
  const heightClass = HEIGHT_CLASS[variant];

  // Base map + tile layer + station markers. Deliberately does NOT depend on
  // selectedStationId — that used to tear down and remount the whole map
  // (tiles included) on every instrument-selector click. The ring now lives
  // in its own effect below so switching stations never re-fetches tiles.
  useEffect(() => {
    if (!containerRef.current || stations.length === 0) return;

    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        attributionControl: interactive,
        zoomControl: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds(stations.map((s) => [s.lat, s.lng]));

      for (const station of stations) {
        // Signal pulse — only for stations genuinely live right now, never
        // decorative (REDESIGN_SPECIFICATION.md §24.2/§24.8). A second,
        // non-interactive ring under the real marker; the CSS animation
        // lives in globals.css and already respects prefers-reduced-motion.
        if (station.freshness === "live") {
          L.circleMarker([station.lat, station.lng], {
            radius: 9,
            weight: 0,
            fillColor: FRESHNESS_COLOR.live,
            fillOpacity: 0.5,
            interactive: false,
            className: "horizon-marker-pulse",
          }).addTo(map);
        }

        const marker = L.circleMarker([station.lat, station.lng], {
          radius: 9,
          weight: 2,
          color: "#fbfaf7",
          fillColor: FRESHNESS_COLOR[station.freshness],
          fillOpacity: 1,
        }).addTo(map);

        marker.bindTooltip(station.name, { direction: "top", offset: [0, -8] });
        if (interactive) {
          marker.on("click", () => router.push(`/s/${station.id}`));
          (marker.getElement() as SVGElement | undefined)?.style.setProperty("cursor", "pointer");
        }
      }

      if (stations.length === 1) {
        map.setView([stations[0].lat, stations[0].lng], 14);
      } else {
        map.fitBounds(bounds, { padding: [32, 32] });
      }

      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      ringRef.current = null;
      setMapReady(false);
    };
  }, [stations, router, interactive]);

  // Selected-station ring — a separate, lightweight effect so picking a
  // different instrument only redraws this one small layer (with a soft
  // grow/fade transition) instead of remounting the whole map.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;

    ringRef.current?.remove();
    ringRef.current = null;

    const station = stations.find((s) => s.id === selectedStationId);
    if (!station) return;

    const ring = L.circleMarker([station.lat, station.lng], {
      radius: 14,
      weight: 1.5,
      color: "#0e5f8a",
      fillOpacity: 0,
      interactive: false,
      className: "horizon-selection-ring",
    }).addTo(map);
    ringRef.current = ring;

    const el = ring.getElement();
    if (el instanceof SVGElement) {
      el.setAttribute("r", "9");
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.transition = `r var(--motion-medium) var(--ease-standard), opacity var(--motion-medium) var(--ease-standard)`;
        el.setAttribute("r", "14");
        el.style.opacity = "1";
      });
    }
  }, [stations, selectedStationId, mapReady]);

  if (stations.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 p-10 text-center", heightClass)}>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted">Bản đồ trạm</p>
        <h3 className="mt-3 text-lg font-semibold tracking-tight">Chưa có tọa độ trạm để hiển thị</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Bản đồ sẽ hiện các trạm thực khi kết nối được với dữ liệu vị trí từ hệ thống. Không có vị trí giả nào được hiển thị.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "isolate w-full overflow-hidden rounded-lg border border-border",
        heightClass,
        !interactive && "pointer-events-none",
      )}
      role="img"
      aria-label={`Bản đồ vị trí ${stations.length} trạm quan trắc`}
    />
  );
}
