import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm text-muted">{note}</p>
      </CardContent>
    </Card>
  );
}
