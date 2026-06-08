import type { TelemetryPayloadV1 } from "./types.js";

function fmtNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function buildCanonicalString(payload: TelemetryPayloadV1): string {
  return [
    payload.device_id,
    payload.message_id,
    payload.timestamp.toString(),
    fmtNumber(payload.salinity),
    fmtNumber(payload.water_level),
    payload.fault_flags.toString(),
    payload.sensor_status.ec_probe,
    payload.sensor_status.ultrasonic,
    fmtNumber(payload.battery_voltage),
    payload.signal_strength_dbm.toString(),
    payload.firmware_version,
    payload.contract_version,
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
