"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
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
   * `full` (default) is the interactive dashboard map. `preview` is a
   * shorter, locked-view instance for the homepage — real data, no pan/zoom/
   * click, so it reads as a preview rather than a second full map instance
   * (REDESIGN_SPECIFICATION.md §13).
   */
  variant?: "full" | "preview";
}

/**
 * Real geographic map (Leaflet + CartoDB Positron tiles — a restrained,
 * near-monochrome basemap, not the default OSM colorway) driven entirely
 * by real `stations.lat`/`lng`. Never renders a marker for a station this
 * component wasn't given real coordinates for — no placeholder pins, no
 * invented positions. Mounted client-side only; Leaflet touches `window`
 * at load time and has no SSR story.
 */
export function StationNetworkMap({ stations, variant = "full" }: StationNetworkMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const interactive = variant === "full";
  const heightClass = interactive ? "h-[340px]" : "h-[260px]";

  useEffect(() => {
    if (!containerRef.current || stations.length === 0) return;

    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        attributionControl: interactive,
        zoomControl: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
      });

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
          }).addTo(map!);
        }

        const marker = L.circleMarker([station.lat, station.lng], {
          radius: 9,
          weight: 2,
          color: "#fbfaf7",
          fillColor: FRESHNESS_COLOR[station.freshness],
          fillOpacity: 1,
        }).addTo(map!);

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
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [stations, router, interactive]);

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
