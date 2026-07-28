import { Calendar, Clock, MapPin, Users, Building2, ExternalLink, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import type { CareerEvent } from "@/lib/types";
import { googleCalendarLink, outlookCalendarLink } from "@/lib/calendar-links";
import { format, parseISO } from "date-fns";

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
}: {
  event: CareerEvent | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!event) return null;
  const fullPct = Math.min(100, Math.round((event.registered_count / Math.max(event.capacity, 1)) * 100));
  const available = Math.max(0, event.capacity - event.registered_count);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {event.event_type.replace("-", " ")} · {event.industry}
            </span>
          </div>
          <DialogTitle className="text-2xl">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground leading-relaxed">{event.description}</p>

          <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/40 p-4 sm:grid-cols-2">
            <Info icon={<Calendar className="h-4 w-4" />} label="Date" value={format(parseISO(event.date), "EEE, dd MMM yyyy")} />
            <Info icon={<Clock className="h-4 w-4" />} label="Time" value={`${event.start_time} – ${event.end_time}`} />
            <Info icon={<MapPin className="h-4 w-4" />} label="Venue" value={`${event.location}, ${event.state}`} />
            <Info icon={<GraduationCap className="h-4 w-4" />} label="University" value={event.university} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Organiser" value={event.organiser} />
            <Info
              icon={<Users className="h-4 w-4" />}
              label="Capacity"
              value={`${event.registered_count} / ${event.capacity} — ${available} seats left`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Registrations</span>
              <span>{fullPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${fullPct}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild disabled={event.status === "cancelled" || event.status === "full"}>
              <a href={event.registration_url} target="_blank" rel="noreferrer">
                Register <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={googleCalendarLink(event)} target="_blank" rel="noreferrer">Add to Google Calendar</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={outlookCalendarLink(event)} target="_blank" rel="noreferrer">Add to Outlook</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
