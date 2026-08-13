"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { FreshnessState } from "@/components/ui/status-indicator";

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

/**
 * Real geographic map (Leaflet + CartoDB Positron tiles — a restrained,
 * near-monochrome basemap, not the default OSM colorway) driven entirely
 * by real `stations.lat`/`lng`. Never renders a marker for a station this
 * component wasn't given real coordinates for — no placeholder pins, no
 * invented positions. Mounted client-side only; Leaflet touches `window`
 * at load time and has no SSR story.
 */
export function StationNetworkMap({ stations }: { stations: MapStation[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current || stations.length === 0) return;

    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        attributionControl: true,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds(stations.map((s) => [s.lat, s.lng]));

      for (const station of stations) {
        const marker = L.circleMarker([station.lat, station.lng], {
          radius: 9,
          weight: 2,
          color: "#fbfaf7",
          fillColor: FRESHNESS_COLOR[station.freshness],
          fillOpacity: 1,
        }).addTo(map!);

        marker.bindTooltip(station.name, { direction: "top", offset: [0, -8] });
        marker.on("click", () => router.push(`/s/${station.id}`));
        (marker.getElement() as SVGElement | undefined)?.style.setProperty("cursor", "pointer");
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
  }, [stations, router]);

  if (stations.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 p-10 text-center">
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
      className="h-[420px] w-full overflow-hidden rounded-lg border border-border"
      role="img"
      aria-label={`Bản đồ vị trí ${stations.length} trạm quan trắc`}
    />
  );
}
