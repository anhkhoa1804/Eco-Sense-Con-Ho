import type { TelemetryPayloadV1 } from "./types.js";

function fmtNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function buildCanonicalString(payload: TelemetryPayloadV1): string {
  const str = (v: any) => (v !== undefined && v !== null ? String(v) : "");
  const num = (v: any) => (typeof v === "number" ? fmtNumber(v) : "");

  return [
    str(payload.device_id),
    str(payload.message_id),
    str(payload.timestamp),
    num(payload.salinity),
    num(payload.water_level),
    str(payload.fault_flags),
    str(payload.sensor_status?.ec_probe),
    str(payload.sensor_status?.ultrasonic),
    num(payload.battery_voltage),
    str(payload.signal_strength_dbm),
    str(payload.firmware_version),
    str(payload.contract_version),
  ].join("|");
}

export async function signPayload(payload: TelemetryPayloadV1, deviceSecret: string): Promise<string> {
  const canonical = buildCanonicalString(payload);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(deviceSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(canonical));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
