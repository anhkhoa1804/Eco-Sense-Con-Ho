import type {
  EnvironmentalEventRow,
  EnvironmentalReadingRow,
  IngestionAuditLogRow,
  OtaInfo,
  StationHealthRow,
} from "./types.js";

export interface DbPort {
  getDeviceSecret(deviceId: string): Promise<string | null>;
  insertEnvironmental(row: EnvironmentalReadingRow): Promise<"inserted" | "duplicate_ignored">;
  insertEvent(row: EnvironmentalEventRow): Promise<void>;
  insertAuditLog(row: IngestionAuditLogRow): Promise<void>;
  insertHealth(row: StationHealthRow): Promise<void>;
  touchDeviceSeen(deviceId: string, firmwareVersion: string, seenAt: number): Promise<void>;
  getActiveOta(deviceId: string): Promise<OtaInfo>;
}
