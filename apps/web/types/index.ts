export type StationStatus = "active" | "inactive" | "maintenance";
export type AlertSeverity = "info" | "warning" | "critical";
export type EventType = "HIGH_SALINITY" | "SENSOR_FAULT" | "LOW_BATTERY" | "OFFLINE";
export type SensorStatus = "ok" | "warn" | "fault";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: StationStatus;
  created_at: string;
}

export interface EnvironmentalReading {
  id: string;
  message_id: string;
  station_id: string;
  salinity: number;
  water_level: number;
  fault_flags: number;
  ec_probe_status: SensorStatus;
  ultrasonic_status: SensorStatus;
  timestamp: string;
  created_at: string;
}

export interface SoilReading {
  id: string;
  message_id: string;
  station_id: string;
  /** Six independent Trạm 2 sensors — each nullable; a faulted probe reports null, never a substituted number (infra/supabase/migrations/019_soil_readings.sql). */
  air_temp_c: number | null;
  air_humidity_pct: number | null;
  soil_temp_c: number | null;
  soil_moisture_pct: number | null;
  soil_ec_ms_cm: number | null;
  soil_ph: number | null;
  fault_flags: number;
  timestamp: string;
  created_at: string;
}

export interface StationHealthLog {
  id: string;
  station_id: string;
  /** Not every station can report these (see docs/ARCHITECTURE_DECISIONS.md) — null means genuinely unmeasured, never fabricated. */
  battery_voltage: number | null;
  signal_strength_dbm: number | null;
  firmware_version: string;
  timestamp: string;
  created_at: string;
}

export interface EnvironmentalEvent {
  id: string;
  station_id: string;
  event_type: EventType;
  severity: AlertSeverity;
  message_id: string | null;
  details: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

export interface StationReadingSnapshot {
  station: Station;
  reading: EnvironmentalReading | null;
  health: StationHealthLog | null;
}

export interface DashboardMetrics {
  activeStations: number;
  totalStations: number;
  averageSalinity: number | null;
  criticalAlerts: number;
  weakSignalNodes: number;
}

export interface DailyComparisonPoint {
  date: string;
  tideLevel: number | null;
  salinity: number | null;
  soilEc: number | null;
  readingCount: number;
}

export interface UserProfile {
  id: string;
  email: string;
  role: "farmer" | "admin" | null;
  phone: string | null;
  assignedStationIds: string[];
}

export interface TrendPoint {
  timestamp: string;
  salinity: number;
  water_level: number;
}

export interface SalinityThreshold {
  cropName: string;
  warningLevel: number;
  criticalLevel: number;
}

export type UserRole = "farmer" | "admin";

export interface RepositoryScope {
  userId: string;
  /**
   * "public" is the anon/public-read path (see lib/publicRead.ts) — never
   * a genuinely authenticated user's role. Treated the same as "admin" for
   * read-scoping purposes (no application-layer station filter — the real
   * boundary there is Postgres RLS), but kept as its own distinct,
   * honestly-named value so it's never mistaken for a real admin session
   * by future code that checks scope.role.
   */
  role: UserRole | "public";
  /** Assigned station IDs for farmers; ignored for admins/public (full read access). */
  stationIds: string[];
}
