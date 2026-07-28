import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import type { CareerEvent, EventType } from "@/lib/types";
import { findConflicts } from "@/lib/api";
import { generateDescription } from "@/lib/ai";
import { toast } from "sonner";

const EVENT_TYPES: EventType[] = ["career-fair", "recruitment-drive", "workshop", "networking", "webinar"];
const STATES = ["Kuala Lumpur", "Selangor", "Penang", "Johor", "Sabah", "Sarawak", "Melaka", "Perak", "Kedah"];

export type EventFormValues = Omit<CareerEvent, "id" | "created_at" | "updated_at" | "status" | "registered_count" | "deleted_at">;

const empty: EventFormValues = {
  title: "",
  description: "",
  location: "",
  state: "Kuala Lumpur",
  university: "",
  company: "",
  industry: "Technology",
  event_type: "career-fair",
  date: new Date().toISOString().slice(0, 10),
  start_time: "09:00",
  end_time: "17:00",
  capacity: 200,
  registration_url: "https://",
  organiser: "",
  created_by: "",
};

export function EventFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: CareerEvent | null;
  onSubmit: (values: EventFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<EventFormValues>(empty);
  const [conflicts, setConflicts] = useState<CareerEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initial) {
      const { id, created_at, updated_at, status, registered_count, deleted_at, ...rest } = initial;
      void id; void created_at; void updated_at; void status; void registered_count; void deleted_at;
      setValues(rest);
    } else {
      setValues(empty);
    }
    setConflicts([]);
    setErrors({});
  }, [initial, open]);

  const conflictKey = useMemo(
    () => `${values.date}|${values.start_time}|${values.end_time}|${values.location}|${values.university}`,
    [values.date, values.start_time, values.end_time, values.location, values.university],
  );

  useEffect(() => {
    if (!open) return;
    if (!values.date || !values.start_time || !values.end_time) return;
    void findConflicts({
      id: initial?.id,
      date: values.date,
      start_time: values.start_time,
      end_time: values.end_time,
      location: values.location,
      university: values.university,
    }).then(setConflicts);
  }, [conflictKey, open, initial?.id, values.date, values.start_time, values.end_time, values.location, values.university]);

  function set<K extends keyof EventFormValues>(k: K, v: EventFormValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!values.title.trim()) e.title = "Title is required";
    if (!values.company.trim()) e.company = "Company is required";
    if (!values.university.trim()) e.university = "University is required";
    if (!values.location.trim()) e.location = "Location is required";
    if (values.start_time >= values.end_time) e.time = "End must be after start";
    if (values.capacity <= 0) e.capacity = "Capacity must be positive";
    if (!/^https?:\/\//.test(values.registration_url)) e.registration_url = "Must be a valid URL";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAiGenerate() {
    if (!values.title || !values.company) {
      toast.error("Fill in title and company first");
      return;
    }
    setGenLoading(true);
    try {
      const description = await generateDescription({
        title: values.title,
        company: values.company,
        university: values.university,
        industry: values.industry,
        event_type: values.event_type,
      });
      set("description", description);
      toast.success("AI description generated");
    } catch {
      toast.error("Could not generate description");
    } finally {
      setGenLoading(false);
    }
  }

  async function handleSave(force = false) {
    if (!validate()) return;
    if (conflicts.length && !force) {
      toast.warning(`${conflicts.length} scheduling conflict(s) detected — review below and confirm.`);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit event" : "Create event"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" error={errors.title} className="md:col-span-2">
            <Input value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Google × UM Career Fair 2026" />
          </Field>

          <Field label="Company" error={errors.company}>
            <Input value={values.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="University" error={errors.university}>
            <Input value={values.university} onChange={(e) => set("university", e.target.value)} />
          </Field>

          <Field label="Location / Venue" error={errors.location}>
            <Input value={values.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="State">
            <Select value={values.state} onValueChange={(v) => set("state", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          <Field label="Event type">
            <Select value={values.event_type} onValueChange={(v) => set("event_type", v as EventType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("-", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Industry">
            <Input value={values.industry} onChange={(e) => set("industry", e.target.value)} />
          </Field>

          <Field label="Date">
            <Input type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Time" error={errors.time}>
            <div className="flex items-center gap-2">
              <Input type="time" value={values.start_time} onChange={(e) => set("start_time", e.target.value)} />
              <span className="text-muted-foreground">–</span>
              <Input type="time" value={values.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </div>
          </Field>

          <Field label="Capacity" error={errors.capacity}>
            <Input type="number" min={1} value={values.capacity} onChange={(e) => set("capacity", Number(e.target.value))} />
          </Field>
          <Field label="Organiser">
            <Input value={values.organiser} onChange={(e) => set("organiser", e.target.value)} />
          </Field>

          <Field label="Registration URL" error={errors.registration_url} className="md:col-span-2">
            <Input value={values.registration_url} onChange={(e) => set("registration_url", e.target.value)} placeholder="https://…" />
          </Field>

          <Field
            label="Description"
            className="md:col-span-2"
            action={
              <Button type="button" variant="ghost" size="sm" onClick={handleAiGenerate} disabled={genLoading}>
                {genLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                AI generate
              </Button>
            }
          >
            <Textarea rows={5} value={values.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>

        {conflicts.length > 0 && (
          <Alert variant="destructive" className="border-warning/50 bg-warning/10 text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scheduling conflict detected</AlertTitle>
            <AlertDescription>
              This overlaps with {conflicts.length} existing event{conflicts.length > 1 ? "s" : ""} at the same venue or university:
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.title}</span> — {c.date} {c.start_time}–{c.end_time} @ {c.location}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          {conflicts.length > 0 && (
            <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
              Save anyway
            </Button>
          )}
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {initial ? "Save changes" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className = "",
  error,
  action,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={"flex flex-col gap-1.5 " + className}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {action}
      </div>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
