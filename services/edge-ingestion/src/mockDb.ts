import type { DbPort } from "./dbPort.js";
import type { EnvironmentalEventRow, EnvironmentalReadingRow, IngestionAuditLogRow, OtaInfo, StationHealthRow } from "./types.js";

export class MockDb implements DbPort {
  private readonly messageIds = new Set<string>();
  private readonly healthKeys = new Set<string>();
  private readonly eventKeys = new Set<string>();
  private readonly auditKeys = new Set<string>();
  private readonly environmentalReadings: EnvironmentalReadingRow[] = [];
  private readonly environmentalEvents: EnvironmentalEventRow[] = [];
  private readonly auditLogs: IngestionAuditLogRow[] = [];
  private readonly healthLogs: StationHealthRow[] = [];

  public constructor(
    private readonly deviceSecrets: Record<string, string> = {},
    private readonly otaCatalog: Record<string, OtaInfo> = {},
  ) {}

  public async getDeviceSecret(deviceId: string): Promise<string | null> {
    return this.deviceSecrets[deviceId] ?? null;
  }

  public async insertEnvironmental(row: EnvironmentalReadingRow): Promise<"inserted" | "duplicate_ignored"> {
    if (this.messageIds.has(row.message_id)) {
      return "duplicate_ignored";
    }

    this.messageIds.add(row.message_id);
    this.environmentalReadings.push(row);
    return "inserted";
  }

  public async insertEvent(row: EnvironmentalEventRow): Promise<void> {
    const key = `${row.station_id}|${row.event_type}|${row.timestamp}|${row.message_id ?? ""}`;
    if (this.eventKeys.has(key)) {
      return;
    }

    this.eventKeys.add(key);
    this.environmentalEvents.push(row);
  }

  public async insertAuditLog(row: IngestionAuditLogRow): Promise<void> {
    const key = `${row.message_id}|${row.device_id}|${row.status}|${row.timestamp}`;
    if (this.auditKeys.has(key)) {
      return;
    }

    this.auditKeys.add(key);
    this.auditLogs.push(row);
  }

  public async insertHealth(row: StationHealthRow): Promise<void> {
    const key = `${row.station_id}|${row.timestamp}|${row.firmware_version}`;
    if (this.healthKeys.has(key)) {
      return;
    }

    this.healthKeys.add(key);
    this.healthLogs.push(row);
  }

  public async touchDeviceSeen(_deviceId: string, _firmwareVersion: string, _seenAt: number): Promise<void> {
    return;
  }

  public async getActiveOta(deviceId: string): Promise<OtaInfo> {
    return this.otaCatalog[deviceId] ?? { update_available: false };
  }

  public getSnapshot(): {
    environmentalReadings: EnvironmentalReadingRow[];
    environmentalEvents: EnvironmentalEventRow[];
    auditLogs: IngestionAuditLogRow[];
    healthLogs: StationHealthRow[];
  } {
    return {
      environmentalReadings: [...this.environmentalReadings],
      environmentalEvents: [...this.environmentalEvents],
      auditLogs: [...this.auditLogs],
      healthLogs: [...this.healthLogs],
    };
  }
}
