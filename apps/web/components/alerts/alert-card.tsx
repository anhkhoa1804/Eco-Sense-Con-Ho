import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventTitle, formatTimestamp, severityLabel } from "@/lib/utils";
import type { EnvironmentalEvent } from "@/types";

export function AlertCard({ alert, stationName }: { alert: EnvironmentalEvent; stationName?: string }) {
  const variant = alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "warning" : "default";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">{eventTitle(alert.event_type)}</CardTitle>
        <Badge variant={variant}>{severityLabel(alert.severity)}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted">{stationName ?? alert.station_id}</p>
        <p className="text-sm leading-relaxed">{JSON.stringify(alert.details)}</p>
        <p className="text-xs text-muted">{formatTimestamp(alert.timestamp)}</p>
      </CardContent>
    </Card>
  );
}
