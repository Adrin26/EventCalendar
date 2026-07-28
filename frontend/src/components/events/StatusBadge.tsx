import type { EventStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<EventStatus, string> = {
  scheduled: "bg-info/15 text-info border-info/30",
  full: "bg-warning/20 text-warning-foreground border-warning/40",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  deleted: "bg-muted text-muted-foreground border-border line-through",
};

export function StatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        STYLES[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
