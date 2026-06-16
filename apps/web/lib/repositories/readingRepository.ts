import {
  applyStationIdScope,
  applyStationScope,
  canAccessStation,
  type AppSupabase,
} from "./base";
import type {
  EnvironmentalReading,
  RepositoryScope,
  StationHealthLog,
  StationReadingSnapshot,
  TrendPoint,
} from "@/types";
import { StationRepository } from "./stationRepository";

const WEAK_SIGNAL_DBM = -95;

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

    if (error) throw error;

    return (data ?? []).map((row) => ({
      timestamp: row.timestamp as string,
      salinity: Number(row.salinity),
      water_level: Number(row.water_level),
    }));
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
}
