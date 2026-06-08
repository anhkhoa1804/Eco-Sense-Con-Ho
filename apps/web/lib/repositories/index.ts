import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertRepository } from "./alertRepository";
import { ReadingRepository } from "./readingRepository";
import { StationRepository } from "./stationRepository";
import { UserRepository } from "./userRepository";
import type { DashboardMetrics, RepositoryScope } from "@/types";

export function createRepositories(supabase: SupabaseClient) {
  return {
    stations: new StationRepository(supabase),
    readings: new ReadingRepository(supabase),
    alerts: new AlertRepository(supabase),
    users: new UserRepository(supabase),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export async function getDashboardMetrics(repos: Repositories, scope: RepositoryScope): Promise<DashboardMetrics> {
  const [counts, averageSalinity, criticalAlerts, weakSignalNodes] = await Promise.all([
    repos.stations.getActiveCount(scope),
    repos.readings.getAverageSalinity(scope),
    repos.alerts.countCritical(scope),
    repos.readings.countWeakSignalNodes(scope),
  ]);

  return {
    activeStations: counts.active,
    totalStations: counts.total,
    averageSalinity,
    criticalAlerts,
    weakSignalNodes,
  };
}

export { AlertRepository, ReadingRepository, StationRepository, UserRepository };
