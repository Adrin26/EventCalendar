import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, Copy, Ban, RotateCcw, Trash2, ArrowUpDown } from "lucide-react";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { CalendarView } from "@/components/events/CalendarView";
import { EventDetailDialog } from "@/components/events/EventDetailDialog";
import { EventFilters, applyFilters, emptyFilters, type Filters } from "@/components/events/EventFilters";
import { EventFormDialog, type EventFormValues } from "@/components/events/EventFormDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/events/StatusBadge";
import {
  cancelEvent,
  createEvent,
  duplicateEvent,
  listEvents,
  restoreEvent,
  softDeleteEvent,
  updateEvent,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CareerEvent } from "@/lib/types";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/admin/events")({
  head: () => ({ meta: [{ title: "Manage Events — CareerFair Admin" }, { name: "description", content: "Create, edit, reschedule and manage career fair events." }] }),
  component: () => <RequireAdmin><EventsAdmin /></RequireAdmin>,
});

function EventsAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", "admin"],
    queryFn: () => listEvents({ includeDeleted: true }),
  });

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CareerEvent | null>(null);
  const [selected, setSelected] = useState<CareerEvent | null>(null);
  const [sort, setSort] = useState<{ key: keyof CareerEvent; dir: "asc" | "desc" }>({ key: "date", dir: "asc" });

  const filtered = useMemo(() => {
    const f = applyFilters(events, filters);
    return f.slice().sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [events, filters, sort]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["audit"] });
  };

  const mCreate = useMutation({
    mutationFn: (v: EventFormValues) => createEvent({ ...v, created_by: user?.id ?? "" }, user),
    onSuccess: () => { toast.success("Event created"); invalidate(); },
  });
  const mUpdate = useMutation({
    mutationFn: ({ id, v }: { id: string; v: Partial<CareerEvent> }) => updateEvent(id, v, user),
    onSuccess: () => { toast.success("Event saved"); invalidate(); },
  });
  const mCancel = useMutation({
    mutationFn: (id: string) => cancelEvent(id, user),
    onSuccess: () => { toast.success("Event cancelled"); invalidate(); },
  });
  const mRestore = useMutation({
    mutationFn: (id: string) => restoreEvent(id, user),
    onSuccess: () => { toast.success("Event restored"); invalidate(); },
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => softDeleteEvent(id, user),
    onSuccess: () => { toast.success("Event deleted"); invalidate(); },
  });
  const mDup = useMutation({
    mutationFn: (id: string) => duplicateEvent(id, user),
    onSuccess: () => { toast.success("Duplicated"); invalidate(); },
  });

  async function handleFormSubmit(v: EventFormValues) {
    if (editing) await mUpdate.mutateAsync({ id: editing.id, v });
    else await mCreate.mutateAsync(v);
  }

  function toggleSort(key: keyof CareerEvent) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">Create, reschedule, cancel or restore events.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="mr-1.5 h-4 w-4" />New event
        </Button>
      </div>

      <Card className="relative p-4">
        <EventFilters events={events} value={filters} onChange={setFilters} />
      </Card>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          {isLoading ? (
            <div className="h-[600px] animate-pulse rounded-xl bg-muted" />
          ) : (
            <CalendarView
              events={filtered.filter((e) => e.status !== "deleted")}
              editable
              onEventClick={(e) => { setEditing(e); setOpenForm(true); }}
              onEventDrop={(id, newDate) => {
                mUpdate.mutate({ id, v: { date: newDate } }, {
                  onSuccess: () => toast.success("Event rescheduled"),
                });
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTh label="Title" k="title" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Date" k="date" sort={sort} onSort={toggleSort} />
                    <TableHead>Location</TableHead>
                    <TableHead>University</TableHead>
                    <TableHead>Registrations</TableHead>
                    <SortableTh label="Status" k="status" sort={sort} onSort={toggleSort} />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id} className={e.status === "deleted" ? "opacity-50" : ""}>
                      <TableCell className="max-w-[14rem] w-[14rem] overflow-hidden">
                        <button className="block w-fulltruncate text-left font-medium hover:underline" onClick={() => setSelected(e)}>
                          {e.title}
                        </button>
                        <div className="text-xs text-muted-foreground">{e.company} · {e.industry}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(parseISO(e.date), "dd MMM yyyy")}
                        <div className="text-xs text-muted-foreground">{e.start_time}–{e.end_time}</div>
                      </TableCell>
                      <TableCell className="text-sm">{e.location}<div className="text-xs text-muted-foreground">{e.state}</div></TableCell>
                      <TableCell className="text-sm">{e.university}</TableCell>
                      <TableCell className="text-sm">{e.registered_count}/{e.capacity}</TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(e); setOpenForm(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" title="Duplicate" onClick={() => mDup.mutate(e.id)}><Copy className="h-3.5 w-3.5" /></Button>
                          {e.status !== "cancelled" && e.status !== "deleted" && (
                            <Button variant="ghost" size="icon" title="Cancel" onClick={() => mCancel.mutate(e.id)}><Ban className="h-3.5 w-3.5" /></Button>
                          )}
                          {(e.status === "cancelled" || e.status === "deleted") && (
                            <Button variant="ghost" size="icon" title="Restore" onClick={() => mRestore.mutate(e.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                          )}
                          {e.status !== "deleted" && (
                            <Button variant="ghost" size="icon" title="Delete" onClick={() => mDelete.mutate(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No events match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <EventFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        initial={editing}
        onSubmit={handleFormSubmit}
        onDelete={
          editing
            ? async () => {
                await mDelete.mutateAsync(editing.id);
                setEditing(null);
              }
            : undefined
        }
      />
      <EventDetailDialog event={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function SortableTh({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: keyof CareerEvent;
  sort: { key: keyof CareerEvent; dir: "asc" | "desc" };
  onSort: (k: keyof CareerEvent) => void;
}) {
  return (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(k)}>
        {label} <ArrowUpDown className="h-3 w-3 opacity-60" />
        {sort.key === k && <span className="text-[10px]">{sort.dir}</span>}
      </button>
    </TableHead>
  );
}
