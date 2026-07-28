import { useMemo, useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { CareerEvent, EventStatus, EventType } from "@/lib/types";

export interface Filters {
  q: string;
  state: string;
  event_type: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}
export const emptyFilters: Filters = {
  q: "",
  state: "all",
  event_type: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

export function applyFilters(events: CareerEvent[], f: Filters) {
  const q = f.q.trim().toLowerCase();
  return events.filter((e) => {
    if (q) {
      const hay = [e.title, e.company, e.university, e.location, e.industry, e.state]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.state !== "all" && e.state !== f.state) return false;
    if (f.event_type !== "all" && e.event_type !== f.event_type) return false;
    if (f.status !== "all" && e.status !== f.status) return false;
    if (f.dateFrom && e.date < f.dateFrom) return false;
    if (f.dateTo && e.date > f.dateTo) return false;
    return true;
  });
}

export function EventFilters({
  events,
  value,
  onChange,
}: {
  events: CareerEvent[];
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const states = useMemo(() => Array.from(new Set(events.map((e) => e.state))).sort(), [events]);
  const types = useMemo(
    () => Array.from(new Set(events.map((e) => e.event_type))).sort() as EventType[],
    [events],
  );
  const statuses: EventStatus[] = ["scheduled", "full", "completed", "cancelled"];

  const activeCount =
    (value.state !== "all" ? 1 : 0) +
    (value.event_type !== "all" ? 1 : 0) +
    (value.status !== "all" ? 1 : 0) +
    (value.dateFrom ? 1 : 0) +
    (value.dateTo ? 1 : 0);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Search company, university, location, industry…"
          className="pl-9"
        />
      </div>
      <Button variant="outline" onClick={() => setOpen((o) => !o)} className="justify-start">
        <Filter className="mr-2 h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-2">
            {activeCount}
          </Badge>
        )}
      </Button>
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...emptyFilters, q: value.q })}>
          <X className="mr-1 h-3 w-3" /> Clear
        </Button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 shadow-lg sm:grid-cols-5 sm:relative sm:top-0 sm:mt-0 sm:w-auto sm:shadow-none sm:border-0 sm:p-0 z-10 sm:z-auto sm:hidden">
          {/* mobile filters — simplified */}
        </div>
      )}

      {open && (
        <div className="w-full rounded-xl border bg-card p-4 shadow-sm sm:absolute sm:right-0 sm:top-14 sm:z-30 sm:w-[520px] sm:shadow-lg">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <SelectField
              label="State"
              value={value.state}
              onValueChange={(v) => onChange({ ...value, state: v })}
              options={[{ label: "All states", value: "all" }, ...states.map((s) => ({ label: s, value: s }))]}
            />
            <SelectField
              label="Event type"
              value={value.event_type}
              onValueChange={(v) => onChange({ ...value, event_type: v })}
              options={[{ label: "All types", value: "all" }, ...types.map((s) => ({ label: labelize(s), value: s }))]}
            />
            <SelectField
              label="Status"
              value={value.status}
              onValueChange={(v) => onChange({ ...value, status: v })}
              options={[{ label: "All statuses", value: "all" }, ...statuses.map((s) => ({ label: labelize(s), value: s }))]}
            />
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-medium text-muted-foreground">From</label>
              <Input type="date" value={value.dateFrom} onChange={(e) => onChange({ ...value, dateFrom: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-medium text-muted-foreground">To</label>
              <Input type="date" value={value.dateTo} onChange={(e) => onChange({ ...value, dateTo: e.target.value })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <label className="font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function labelize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
