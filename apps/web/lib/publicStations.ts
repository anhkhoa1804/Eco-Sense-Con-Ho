import { stationProfiles } from "@/lib/stationProfile";
import type { SoilReading, Station, StationReadingSnapshot } from "@/types";

/**
 * The curated 3-node pilot topology — Option A from
 * FRONTEND_REBUILD_SPECIFICATION.md §3.6, firmware-verified (§3.1-3.2): two
 * real sensor stations plus the gateway's public map touchpoint. Identical
 * in spirit to the admin console's existing `managedStationIds`
 * (apps/web/app/admin/page.tsx:27) — this applies the same, already-proven
 * pattern to public read paths instead of inventing a new one.
 *
 * STATION_04/05 are simulator/seed fixtures ("Brackish Edge", "Mangrove
 * Spur" — services/edge-ingestion/scripts/simulator.ts), not operational
 * hardware. No firmware target, no admin config, no documentation anywhere
 * claims otherwise. `StationRepository.getAll()` applies no ID filter for
 * public/admin scope (base.ts's `isUnscopedRead`), so without this filter
 * they leak into any public station list — the source of the "4/5 active"
 * discrepancy identified in the audit.
 *
 * Not yet wired into any live page (Foundation phase only) — call sites
 * are added starting with the homepage/dashboard rebuild.
 */
export const PILOT_STATION_IDS = ["STATION_01", "STATION_02", "STATION_03"] as const;

export type PilotStationId = (typeof PILOT_STATION_IDS)[number];

export function isPilotStation(stationId: string): stationId is PilotStationId {
  return (PILOT_STATION_IDS as readonly string[]).includes(stationId);
}

/**
 * The one place that knows how to build a station URL.
 *
 * Every surface (home, monitoring, about, station detail, the map, report
 * deep-links) previously interpolated `/s/${id}` at its own call site. That is
 * five independent chances for the route shape and the id source to drift —
 * and they had already drifted once, with station-detail's "Trạm khác" list
 * linking to the station the reader was currently on. Routing through one
 * helper means a future route change is a single edit, and the id is always
 * typed as a real pilot station rather than an arbitrary string.
 */
export function stationHref(stationId: PilotStationId): string {
  return `/s/${stationId}`;
}

export function filterToPilotStations(stations: Station[]): Station[] {
  return stations.filter((station) => isPilotStation(station.id));
}

export function filterSnapshotsToPilotStations(
  snapshots: StationReadingSnapshot[],
): StationReadingSnapshot[] {
  return snapshots.filter((snapshot) => isPilotStation(snapshot.station.id));
}

/**
 * STATION_02 has no environmental_readings row — its real timestamp lives
 * on soil_readings instead. Kind-aware so soil freshness is never silently
 * read as "unavailable" just because the water-shaped fields are empty.
 */
export function latestPilotTimestamp(
  stationId: PilotStationId,
  snapshot: StationReadingSnapshot | undefined,
  soilReading: SoilReading | null,
): string | null {
  if (stationProfiles[stationId].kind === "soil") {
    return soilReading?.timestamp ?? null;
  }
  return snapshot?.reading?.timestamp ?? snapshot?.health?.timestamp ?? null;
}
