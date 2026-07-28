import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CalendarClock, CalendarCheck2, CalendarX2, Users, ListChecks, ArrowRight, Sparkles } from "lucide-react";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { StatCard } from "@/components/admin/StatCard";
import { stats, listEvents, audit } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/events/StatusBadge";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — CareerFair" }, { name: "description", content: "Overview of career fair events, registrations and activity." }] }),
  component: () => <RequireAdmin><Dashboard /></RequireAdmin>,
});

function Dashboard() {
  const { data: s, isLoading } = useQuery({ queryKey: ["stats"], queryFn: stats });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => listEvents() });
  const { data: logs = [] } = useQuery({ queryKey: ["audit"], queryFn: audit });

  const upcoming = events
    .filter((e) => e.date >= new Date().toISOString().slice(0, 10) && e.status !== "cancelled" && e.status !== "deleted")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Career fair event overview</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/events" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Manage events <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {isLoading || !s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={Calendar} label="Total" value={s.total} accent="primary" />
          <StatCard icon={CalendarClock} label="Upcoming" value={s.upcoming} accent="info" />
          <StatCard icon={CalendarCheck2} label="Completed" value={s.completed} accent="success" />
          <StatCard icon={CalendarX2} label="Cancelled" value={s.cancelled} accent="destructive" />
          <StatCard icon={ListChecks} label="This month" value={s.this_month} accent="warning" />
          <StatCard icon={Users} label="Registrations" value={s.total_registrations} accent="primary" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Upcoming events</h2>
            <Link to="/admin/events" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming events.</p>}
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(e.date), "EEE, dd MMM")} · {e.location}, {e.state}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{e.registered_count}/{e.capacity}</span>
                  <StatusBadge status={e.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Activity</h2>
            <Link to="/admin/audit" className="text-xs text-primary hover:underline">Audit log</Link>
          </div>
          <div className="space-y-2 text-sm">
            {logs.slice(0, 8).map((l) => (
              <div key={l.id} className="border-l-2 border-primary/40 pl-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium capitalize">{l.action}</span>
                  <span className="truncate text-xs text-muted-foreground">— {l.event_title}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {l.user_name} · {format(new Date(l.timestamp), "dd MMM HH:mm")}
                </div>
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col items-start gap-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-info/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5" /> AI features</div>
          <h3 className="mt-1 font-semibold">Ask the AI assistant to run bulk actions</h3>
          <p className="text-sm text-muted-foreground">Move, cancel, or reschedule events with natural language — with confirmation.</p>
        </div>
        <Link to="/admin/assistant" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Open AI Assistant <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>
    </div>
  );
}
