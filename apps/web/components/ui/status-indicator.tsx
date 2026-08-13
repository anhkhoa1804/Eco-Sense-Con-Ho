import type * as React from "react";
import {
  AlertOctagon,
  CircleDashed,
  CircleSlash,
  Clock,
  History,
  Radio,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Freshness — when did data last arrive, if ever. Independent of value
 * quality (below): a station can be LIVE and simultaneously reporting a
 * sensor ERROR. Independent of `stations.status` too, which is an
 * administrator-set operational-intent field, never merged into this —
 * see docs/TELEMETRY_STATE_MODEL.md for the full reasoning. This replaces
 * an earlier version of this type that mixed freshness and value-quality
 * into one 9-value enum, four of which (estimated/invalid/warning/
 * critical) were never actually produced anywhere in the codebase.
 */
export type FreshnessState = "live" | "recent" | "stale" | "offline" | "never_connected" | "unavailable";

/** Value quality — when a reading exists, should it be trusted. Orthogonal to freshness. */
export type QualityState = "valid" | "estimated" | "error";

const FRESHNESS_META: Record<
  FreshnessState,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: "healthy" | "watch" | "risk" | "offline"; pulse?: boolean }
> = {
  live: { label: "Trực tiếp", icon: Radio, tone: "healthy", pulse: true },
  recent: { label: "Gần đây", icon: Clock, tone: "healthy" },
  stale: { label: "Dữ liệu cũ", icon: History, tone: "watch" },
  offline: { label: "Mất kết nối", icon: WifiOff, tone: "offline" },
  never_connected: { label: "Chưa từng kết nối", icon: CircleSlash, tone: "offline" },
  unavailable: { label: "Chưa có dữ liệu", icon: CircleDashed, tone: "offline" },
};

const QUALITY_META: Record<
  QualityState,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: "healthy" | "watch" | "risk" | "offline" }
> = {
  valid: { label: "Đo trực tiếp", icon: Radio, tone: "healthy" },
  estimated: { label: "Giá trị ước tính", icon: Sparkles, tone: "watch" },
  error: { label: "Cảm biến lỗi", icon: AlertOctagon, tone: "risk" },
};

/**
 * Quality-axis sibling to StatusIndicator — same visual language (icon +
 * label, never color-only), separate component because the two axes are
 * structurally independent (see FreshnessState/QualityState above) and a
 * shared prop type would blur that distinction back together.
 */
export function QualityIndicator({ status, compact = false, className }: { status: QualityState; compact?: boolean; className?: string }) {
  const meta = QUALITY_META[status];
  const Icon = meta.icon;

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", toneClasses[meta.tone], className)}>
        <Icon className="h-3 w-3" aria-hidden />
        {meta.label}
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", toneClasses[meta.tone])} aria-hidden />
      <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", toneClasses[meta.tone])}>{meta.label}</p>
    </div>
  );
}

const toneClasses: Record<"healthy" | "watch" | "risk" | "offline", string> = {
  healthy: "text-healthy",
  watch: "text-watch",
  risk: "text-risk",
  offline: "text-offline",
};

const dotClasses: Record<"healthy" | "watch" | "risk" | "offline", string> = {
  healthy: "bg-healthy",
  watch: "bg-watch",
  risk: "bg-risk",
  offline: "bg-offline",
};

interface StatusIndicatorProps {
  status: FreshnessState;
  detail?: string;
  compact?: boolean;
  className?: string;
}

/**
 * The provenance/status primitive. Never conveys state through color alone —
 * always pairs an icon and a text label, per the data-honesty requirement
 * that a measurement's state (live/recent/stale/offline/...) is legible on
 * its own, not inferred from a colored dot.
 */
export function StatusIndicator({ status, detail, compact = false, className }: StatusIndicatorProps) {
  const meta = FRESHNESS_META[status];
  const Icon = meta.icon;

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", toneClasses[meta.tone], className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[meta.tone], meta.pulse && "animate-pulse")} aria-hidden />
        {meta.label}
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-start gap-2", className)}>
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", toneClasses[meta.tone])} aria-hidden />
      <div className="space-y-0.5">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", toneClasses[meta.tone])}>{meta.label}</p>
        {detail ? <p className="text-xs text-muted">{detail}</p> : null}
      </div>
    </div>
  );
}

/**
 * Derives a FreshnessState from a timestamp. `hasEverConnected` lets a
 * caller that knows the difference (e.g. checked `stations.created_at`
 * or a row-count) distinguish "this station has never sent a reading"
 * from "no data source exists for this metric" — callers that don't know
 * get the older, safer default (`unavailable`), never a guess.
 */
export function freshnessStatus(
  timestampIso: string | null | undefined,
  options: { thresholds?: { liveMs: number; recentMs: number; staleMs: number }; hasEverConnected?: boolean } = {},
): FreshnessState {
  const thresholds = options.thresholds ?? { liveMs: 5 * 60_000, recentMs: 30 * 60_000, staleMs: 6 * 60 * 60_000 };

  if (!timestampIso) {
    return options.hasEverConnected === false ? "never_connected" : "unavailable";
  }
  const ageMs = Date.now() - new Date(timestampIso).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "unavailable";
  if (ageMs <= thresholds.liveMs) return "live";
  if (ageMs <= thresholds.recentMs) return "recent";
  if (ageMs <= thresholds.staleMs) return "stale";
  return "offline";
}

export function relativeTimeVi(timestampIso: string): string {
  const ms = Date.now() - new Date(timestampIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "vừa xong";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  return `${day} ngày trước`;
}
