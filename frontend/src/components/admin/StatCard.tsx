import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const tone = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
  }[accent];

  return (
    <Card className="flex flex-col gap-2 p-4 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={"grid h-8 w-8 place-items-center rounded-lg " + tone}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
