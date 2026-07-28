import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listEvents } from "@/lib/api";
import { CalendarView } from "@/components/events/CalendarView";
import { EventDetailDialog } from "@/components/events/EventDetailDialog";
import { EventFilters, applyFilters, emptyFilters, type Filters } from "@/components/events/EventFilters";
import { Skeleton } from "@/components/ui/skeleton";
import type { CareerEvent } from "@/lib/types";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Career Fair Calendar — Discover events in Malaysia" },
      { name: "description", content: "Browse career fairs, workshops, and networking events across Malaysian universities. Month, week, day and agenda views." },
      { property: "og:title", content: "Career Fair Calendar — Discover events in Malaysia" },
      { property: "og:description", content: "Browse career fairs, workshops, and networking events across Malaysian universities." },
    ],
  }),
  component: PublicCalendar,
});

function PublicCalendar() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", "public"],
    queryFn: () => listEvents(),
  });

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<CareerEvent | null>(null);

  const filtered = useMemo(() => applyFilters(events, filters), [events, filters]);

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-info/10 p-6 sm:p-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> AI-powered career fair discovery
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            The career fair calendar for Malaysia.
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Explore every upcoming career fair, recruitment drive, and workshop. Search by company, university,
            state or industry — and register in one click.
          </p>
        </div>
      </section>

      <Card className="relative p-4">
        <EventFilters events={events} value={filters} onChange={setFilters} />
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[560px] w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of {events.length} events
          </div>
          <CalendarView events={filtered} onEventClick={(e) => setSelected(e)} />
        </>
      )}

      <EventDetailDialog event={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
