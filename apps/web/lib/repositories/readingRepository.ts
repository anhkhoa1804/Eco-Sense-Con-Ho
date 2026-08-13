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
  SoilReading,
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

function numberOrNull(value: unknown): number | null {
  // Number(null) is 0 in JS — that would silently turn "not measured" into
  // a fabricated-looking zero reading, so null must be checked explicitly
  // before coercing.
  return value === null || value === undefined ? null : Number(value);
}

function mapHealth(row: Record<string, unknown>): StationHealthLog {
  return {
    id: row.id as string,
    station_id: row.station_id as string,
    battery_voltage: numberOrNull(row.battery_voltage),
    signal_strength_dbm: numberOrNull(row.signal_strength_dbm),
    firmware_version: row.firmware_version as string,
    timestamp: row.timestamp as string,
    created_at: row.created_at as string,
  };
}

function mapSoilReading(row: Record<string, unknown>): SoilReading {
  return {
    id: row.id as string,
    message_id: row.message_id as string,
    station_id: row.station_id as string,
    air_temp_c: numberOrNull(row.air_temp_c),
    air_humidity_pct: numberOrNull(row.air_humidity_pct),
    soil_temp_c: numberOrNull(row.soil_temp_c),
    soil_moisture_pct: numberOrNull(row.soil_moisture_pct),
    soil_ec_ms_cm: numberOrNull(row.soil_ec_ms_cm),
    soil_ph: numberOrNull(row.soil_ph),
    fault_flags: Number(row.fault_flags),
    timestamp: row.timestamp as string,
    created_at: row.created_at as string,
  };
}

export class ReadingRepository {
  constructor(private readonly supabase: AppSupabase) {}

  /** No fabricated curve — genuinely missing data renders as null, not invented values. */
  private emptyDailyComparison(days: number): DailyComparisonPoint[] {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.now() - (days - index - 1) * 24 * 60 * 60 * 1000);
      return {
        date: shortDateLabel(dateKey(date.toISOString())),
        tideLevel: null,
        salinity: null,
        soilEc: null,
        readingCount: 0,
      };
    });
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

  async getLatestSoilReadingByStation(stationId: string, scope: RepositoryScope): Promise<SoilReading | null> {
    if (!canAccessStation(scope, stationId)) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("soil_readings")
      .select("*")
      .eq("station_id", stationId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingTableError(error)) return null;
    if (error) throw error;
    return data ? mapSoilReading(data) : null;
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
    if (isMissingTableError(error)) return this.emptyDailyComparison(days);
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

      // environmental_readings only carries salinity/water_level — soil EC
      // has no real column here and must never be derived from these fields.
      bucket.salinity.push(Number(row.salinity));
      bucket.tideLevel.push(Number(row.water_level));

      buckets.set(key, bucket);
    }

    const keys = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.now() - (days - index - 1) * 24 * 60 * 60 * 1000);
      return dateKey(date.toISOString());
    });

    const average = (values: number[], decimals: number): number | null =>
      values.length > 0
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(decimals))
        : null;

    return keys.map((key) => {
      const bucket = buckets.get(key);

      return {
        date: shortDateLabel(key),
        tideLevel: average(bucket?.tideLevel ?? [], 1),
        salinity: average(bucket?.salinity ?? [], 2),
        soilEc: average(bucket?.soilEc ?? [], 2),
        readingCount: (bucket?.tideLevel.length ?? 0) + (bucket?.salinity.length ?? 0),
      };
    });
  }

  /** null, not 0 — an average of zero readings is undefined, not a measured zero. */
  async getAverageSalinity(scope: RepositoryScope): Promise<number | null> {
    const readings = await this.getLatestForAllStations(scope);
    const values = [...readings.values()].map((r) => r.salinity);
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  async countWeakSignalNodes(scope: RepositoryScope): Promise<number> {
    const health = await this.getLatestHealthForAllStations(scope);
    return [...health.values()].filter(
      (h) => typeof h.signal_strength_dbm === "number" && h.signal_strength_dbm <= WEAK_SIGNAL_DBM,
    ).length;
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
