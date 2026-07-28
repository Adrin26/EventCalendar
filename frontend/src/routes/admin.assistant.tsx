import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, PlayCircle } from "lucide-react";
import { planNLCommand, applyNLPlan, type NLCommandPlan } from "@/lib/ai";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/assistant")({
  head: () => ({ meta: [{ title: "AI Admin Assistant — CareerFair" }, { name: "description", content: "Run natural-language bulk actions on events with human-in-the-loop confirmation." }] }),
  component: () => <RequireAdmin><Assistant /></RequireAdmin>,
});

const SUGGESTIONS = [
  "Move all Johor events to next month",
  "Cancel tomorrow's event at Universiti Teknologi Malaysia",
  "Reschedule all Grab events to July",
];

function Assistant() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cmd, setCmd] = useState("");
  const [plan, setPlan] = useState<NLCommandPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const mApply = useMutation({
    mutationFn: async (p: NLCommandPlan) => applyNLPlan(p, user),
    onSuccess: () => {
      toast.success("Applied changes");
      qc.invalidateQueries();
      setPlan(null);
      setCmd("");
    },
  });

  async function onInterpret() {
    if (!cmd.trim()) return;
    setLoading(true);
    try {
      const p = await planNLCommand(cmd);
      setPlan(p);
    } catch {
      toast.error("Could not interpret command");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-5 w-5 text-primary" /> AI Admin Assistant
        </h1>
        <p className="text-sm text-muted-foreground">Describe what you want to do. I'll interpret it, show you what will change, and only apply after your confirmation.</p>
      </div>

      <Card className="space-y-3 p-5">
        <Textarea
          rows={3}
          placeholder="e.g. Move all Johor events to next month"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setCmd(s)} className="rounded-full border bg-muted px-3 py-1 text-xs hover:bg-accent">
              {s}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={onInterpret} disabled={loading || !cmd.trim()}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Interpret command
          </Button>
        </div>
      </Card>

      {plan && (
        <Card className="space-y-4 border-primary/30 p-5">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="capitalize" variant="secondary">{plan.intent}</Badge>
              <h2 className="font-semibold">Proposed plan</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
          </div>

          {plan.affected_titles.length > 0 ? (
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Affected events ({plan.affected_titles.length})</div>
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-sm">
                {plan.affected_titles.map((t) => <li key={t}>• {t}</li>)}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No events match this command.</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPlan(null)}>Cancel</Button>
            <Button onClick={() => mApply.mutate(plan)} disabled={plan.actions.length === 0 || mApply.isPending}>
              {mApply.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-1.5 h-4 w-4" />}
              Confirm & apply
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
