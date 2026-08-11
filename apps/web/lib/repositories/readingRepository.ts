import {
  applyStationIdScope,
  applyStationScope,
  canAccessStation,
  isMissingTableError,
  type AppSupabase,
} from "./base";
import type {
  DailyComparisonPoint,
  EnvironmentalReading,
  RepositoryScope,
  SalinityThreshold,
  StationHealthLog,
  StationReadingSnapshot,
  TrendPoint,
} from "@/types";
import { StationRepository } from "./stationRepository";

const WEAK_SIGNAL_DBM = -95;

function dateKey(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function shortDateLabel(key: string): string {
  const date = new Date(`${key}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(date);
}

function numberFromRecord(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rawStationPayload(row: Record<string, unknown>): Record<string, unknown> | null {
  const rawPayload = row.raw_payload;
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return null;
  }

  const stationPayload = (rawPayload as Record<string, unknown>).raw_station_payload;
  if (!stationPayload || typeof stationPayload !== "object" || Array.isArray(stationPayload)) {
    return null;
  }

  return stationPayload as Record<string, unknown>;
}

function mapReading(row: Record<string, unknown>): EnvironmentalReading {
  return {
    id: row.id as string,
    message_id: row.message_id as string,
    station_id: row.station_id as string,
    salinity: Number(row.salinity),
    water_level: Number(row.water_level),
    fault_flags: Number(row.fault_flags),
    ec_probe_status: row.ec_probe_status as EnvironmentalReading["ec_probe_status"],
    ultrasonic_status: row.ultrasonic_status as EnvironmentalReading["ultrasonic_status"],
    timestamp: row.timestamp as string,
    created_at: row.created_at as string,
  };
}

function mapHealth(row: Record<string, unknown>): StationHealthLog {
  return {
    id: row.id as string,
    station_id: row.station_id as string,
    battery_voltage: Number(row.battery_voltage),
    signal_strength_dbm: Number(row.signal_strength_dbm),
    firmware_version: row.firmware_version as string,
    timestamp: row.timestamp as string,
    created_at: row.created_at as string,
  };
}

export class ReadingRepository {
  constructor(private readonly supabase: AppSupabase) {}

  private demoDailyComparison(days: number): DailyComparisonPoint[] {
    const keys = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.now() - (days - index - 1) * 24 * 60 * 60 * 1000);
      return dateKey(date.toISOString());
    });

    return keys.map((key, index) => ({
      date: shortDateLabel(key),
      tideLevel: Number((48 + index * 2 + (index % 2 === 0 ? 3 : -2)).toFixed(1)),
      salinity: Number((1.1 + index * 0.12 + (index % 3) * 0.08).toFixed(2)),
      soilEc: Number((0.85 + index * 0.06 + (index % 2) * 0.05).toFixed(2)),
      readingCount: 0,
    }));
  }

  async getLatestByStation(stationId: string, scope: RepositoryScope): Promise<EnvironmentalReading | null> {
    if (!canAccessStation(scope, stationId)) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("environmental_readings")
      .select("*")
      .eq("station_id", stationId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingTableError(error)) return null;
    if (error) throw error;
    return data ? mapReading(data) : null;
  }

  async getLatestHealthByStation(stationId: string, scope: RepositoryScope): Promise<StationHealthLog | null> {
    if (!canAccessStation(scope, stationId)) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("station_health_logs")
      .select("*")
      .eq("station_id", stationId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingTableError(error)) return null;
    if (error) throw error;
    return data ? mapHealth(data) : null;
  }

  async getLatestForAllStations(scope: RepositoryScope): Promise<Map<string, EnvironmentalReading>> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Use resource embedding to get the latest reading PER station.
    // This eliminates the global 500-row truncation problem.
    let query = this.supabase
      .from("stations")
      .select(`
        id,
        environmental_readings (
          *
        )
      `)
      .gte("environmental_readings.timestamp", since)
      .order("timestamp", { foreignTable: "environmental_readings", ascending: false })
      .limit(1, { foreignTable: "environmental_readings" });

    query = applyStationIdScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return new Map();
    if (error) throw error;

    const map = new Map<string, EnvironmentalReading>();
    for (const row of (data ?? [])) {
      const readings = row.environmental_readings as Record<string, unknown>[];
      if (readings && readings.length > 0) {
        map.set(row.id, mapReading(readings[0]));
      }
    }
    return map;
  }

  async getLatestHealthForAllStations(scope: RepositoryScope): Promise<Map<string, StationHealthLog>> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Use resource embedding to get the latest health log PER station.
    let query = this.supabase
      .from("stations")
      .select(`
        id,
        station_health_logs (
          *
        )
      `)
      .gte("station_health_logs.timestamp", since)
      .order("timestamp", { foreignTable: "station_health_logs", ascending: false })
      .limit(1, { foreignTable: "station_health_logs" });

    query = applyStationIdScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return new Map();
    if (error) throw error;

    const map = new Map<string, StationHealthLog>();
    for (const row of (data ?? [])) {
      const logs = row.station_health_logs as Record<string, unknown>[];
      if (logs && logs.length > 0) {
        map.set(row.id, mapHealth(logs[0]));
      }
    }
    return map;
  }

  async getSnapshots(scope: RepositoryScope): Promise<StationReadingSnapshot[]> {
    const stationRepo = new StationRepository(this.supabase);
    const [stations, readings, healthLogs] = await Promise.all([
      stationRepo.getAll(scope),
      this.getLatestForAllStations(scope),
      this.getLatestHealthForAllStations(scope),
    ]);

    return stations.map((station) => ({
      station,
      reading: readings.get(station.id) ?? null,
      health: healthLogs.get(station.id) ?? null,
    }));
  }

  async getTrend24h(stationId: string, scope: RepositoryScope): Promise<TrendPoint[]> {
    if (!canAccessStation(scope, stationId)) {
      return [];
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .from("environmental_readings")
      .select("timestamp, salinity, water_level")
      .eq("station_id", stationId)
      .gte("timestamp", since)
      .order("timestamp", { ascending: true });

    if (isMissingTableError(error)) return [];
    if (error) throw error;

    return (data ?? []).map((row) => ({
      timestamp: row.timestamp as string,
      salinity: Number(row.salinity),
      water_level: Number(row.water_level),
    }));
  }

  async getDailyComparison(scope: RepositoryScope, days = 7): Promise<DailyComparisonPoint[]> {
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();
    let query = this.supabase
      .from("environmental_readings")
      .select("timestamp, station_id, salinity, water_level")
      .gte("timestamp", since)
      .order("timestamp", { ascending: true });

    query = applyStationScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return this.demoDailyComparison(days);
    if (error) throw error;

    const buckets = new Map<
      string,
      {
        salinity: number[];
        tideLevel: number[];
        soilEc: number[];
      }
    >();

    for (const row of data ?? []) {
      const key = dateKey(row.timestamp as string);
      const bucket = buckets.get(key) ?? { salinity: [], tideLevel: [], soilEc: [] };
      const salinity = Number(row.salinity);
      const waterLevel = Number(row.water_level);

      bucket.salinity.push(salinity);
      bucket.tideLevel.push(waterLevel);

      if (row.station_id === "STATION_02") {
        bucket.soilEc.push(Math.max(0.2, salinity * 0.72 + waterLevel / 140));
      }

      buckets.set(key, bucket);
    }

    const { data: gatewayRows, error: gatewayError } = await this.supabase
      .from("gateway_observations")
      .select("received_at, station_id, raw_payload")
      .gte("received_at", since)
      .order("received_at", { ascending: true });

    if (!gatewayError) {
      for (const row of gatewayRows ?? []) {
        const stationPayload = rawStationPayload(row as Record<string, unknown>);
        if (!stationPayload) {
          continue;
        }

        const key = dateKey(row.received_at as string);
        const bucket = buckets.get(key) ?? { salinity: [], tideLevel: [], soilEc: [] };
        const stationId = row.station_id as string;

        if (stationId === "STATION_01") {
          const waterLevel = numberFromRecord(stationPayload, "water_level_cm");
          const salinity = numberFromRecord(stationPayload, "salinity_ppt");

          if (waterLevel !== null) bucket.tideLevel.push(waterLevel);
          if (salinity !== null) bucket.salinity.push(salinity);
        }

        if (stationId === "STATION_02") {
          const soilEc = numberFromRecord(stationPayload, "soil_ec_ms_cm");
          if (soilEc !== null) bucket.soilEc.push(soilEc);
        }

        buckets.set(key, bucket);
      }
    }

    const keys = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.now() - (days - index - 1) * 24 * 60 * 60 * 1000);
      return dateKey(date.toISOString());
    });

    return keys.map((key, index) => {
      const bucket = buckets.get(key);
      const fallbackTide = 48 + index * 2 + (index % 2 === 0 ? 3 : -2);
      const fallbackSalinity = 1.1 + index * 0.12 + (index % 3) * 0.08;
      const fallbackSoilEc = 0.85 + index * 0.06 + (index % 2) * 0.05;

      const average = (values: number[], fallback: number) =>
        values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;

      return {
        date: shortDateLabel(key),
        tideLevel: Number(average(bucket?.tideLevel ?? [], fallbackTide).toFixed(1)),
        salinity: Number(average(bucket?.salinity ?? [], fallbackSalinity).toFixed(2)),
        soilEc: Number(average(bucket?.soilEc ?? [], fallbackSoilEc).toFixed(2)),
        readingCount: (bucket?.tideLevel.length ?? 0) + (bucket?.salinity.length ?? 0),
      };
    });
  }

  async getAverageSalinity(scope: RepositoryScope): Promise<number> {
    const readings = await this.getLatestForAllStations(scope);
    const values = [...readings.values()].map((r) => r.salinity);
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  async countWeakSignalNodes(scope: RepositoryScope): Promise<number> {
    const health = await this.getLatestHealthForAllStations(scope);
    return [...health.values()].filter((h) => h.signal_strength_dbm <= WEAK_SIGNAL_DBM).length;
  }

  async getDefaultSalinityThreshold(): Promise<SalinityThreshold | null> {
    const { data, error } = await this.supabase
      .from("crop_thresholds")
      .select("crop_name, salinity_warning_level, salinity_critical_level")
      .order("salinity_critical_level", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      cropName: data.crop_name as string,
      warningLevel: Number(data.salinity_warning_level),
      criticalLevel: Number(data.salinity_critical_level),
    };
  }
}
