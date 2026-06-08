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
        <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
        <p className="font-serif text-3xl tracking-tight">{value}</p>
        <p className="text-sm text-muted">{note}</p>
      </CardContent>
    </Card>
  );
}
