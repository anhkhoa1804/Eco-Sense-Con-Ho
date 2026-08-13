import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSalinity(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}‰`;
}

export function formatWaterLevel(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)} cm`;
}

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function severityLabel(severity: string): string {
  switch (severity) {
    case "critical":
      return "Nghiêm trọng";
    case "warning":
      return "Cảnh báo";
    case "info":
      return "Thông tin";
    default:
      return "Bình thường";
  }
}

export function eventTitle(eventType: string): string {
  switch (eventType) {
    case "HIGH_SALINITY":
      return "Cảnh báo độ mặn";
    case "SENSOR_FAULT":
      return "Lỗi cảm biến";
    case "LOW_BATTERY":
      return "Pin yếu";
    case "OFFLINE":
      return "Tín hiệu yếu";
    default:
      return eventType;
  }
}

export function formatAlertDetails(details: Record<string, unknown>): string {
  const salinity = details.salinity;
  const threshold = details.threshold;
  const voltage = details.voltage;
  const signal = details.signal_strength_dbm;

  if (salinity !== undefined && threshold !== undefined) {
    return `Độ mặn ${Number(salinity).toFixed(2)}‰ (ngưỡng ${Number(threshold).toFixed(2)}‰)`;
  }
  if (voltage !== undefined) {
    return `Pin ${Number(voltage).toFixed(2)} V`;
  }
  if (signal !== undefined) {
    return `Tín hiệu ${signal} dBm`;
  }

  const parts = Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length > 0 ? parts.join(" · ") : "Không có chi tiết bổ sung";
}
