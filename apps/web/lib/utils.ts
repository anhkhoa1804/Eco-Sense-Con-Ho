import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSalinity(value: number): string {
  return `${value.toFixed(2)}‰`;
}

export function formatWaterLevel(value: number): string {
  return `${value.toFixed(0)} cm`;
}

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function eventTitle(eventType: string): string {
  switch (eventType) {
    case "HIGH_SALINITY":
      return "Salinity alert";
    case "SENSOR_FAULT":
      return "Sensor fault";
    case "LOW_BATTERY":
      return "Low battery";
    case "OFFLINE":
      return "Weak signal";
    default:
      return eventType;
  }
}
