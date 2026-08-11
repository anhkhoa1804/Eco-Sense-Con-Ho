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

export interface StationHealthLog {
  id: string;
  station_id: string;
  battery_voltage: number;
  signal_strength_dbm: number;
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
  averageSalinity: number;
  criticalAlerts: number;
  weakSignalNodes: number;
}

export interface DailyComparisonPoint {
  date: string;
  tideLevel: number;
  salinity: number;
  soilEc: number;
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

export type UserRole = "farmer" | "admin";

export interface RepositoryScope {
  userId: string;
  role: UserRole;
  /** Assigned station IDs for farmers; ignored for admins (full access). */
  stationIds: string[];
}
