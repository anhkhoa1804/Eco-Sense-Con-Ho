"use client";

import { useEffect, useState } from "react";

export interface LocalGatewayReading {
  gateway_id?: string | null;
  station_id?: string | null;
  message_id?: string | null;
  timestamp?: number | null;
  air_temp_c?: number | null;
  soil_temp_c?: number | null;
  air_humidity_pct?: number | null;
  receivedAt?: string | null;
}

async function fetchLatestLocalGatewayReading(): Promise<LocalGatewayReading | null> {
  const response = await fetch("/api/public/gateway", { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.latest ?? null;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatTemperature(value: number | null | undefined) {
  return value == null ? "--\u00b0C" : `${value.toFixed(2)}\u00b0C`;
}

export function LocalGatewayCard({ initialReading }: { initialReading: LocalGatewayReading | null }) {
  const [reading, setReading] = useState(initialReading);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const latest = await fetchLatestLocalGatewayReading();
        if (active) setReading(latest);
      } catch {
        // Keep the last good reading visible during transient local tunnel errors.
      }
    }

    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Local gateway</p>
        <p className="text-xs text-muted">{formatTime(reading?.receivedAt)}</p>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-4xl font-semibold tracking-tight text-foreground">
            {formatTemperature(reading?.air_temp_c)}
          </div>
          <p className="mt-1 text-sm text-muted">{reading?.station_id ?? "Chua co du lieu"}</p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>Gateway</div>
          <div className="font-medium text-foreground">{reading?.gateway_id ?? "--"}</div>
        </div>
      </div>
    </div>
  );
}
