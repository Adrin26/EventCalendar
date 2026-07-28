import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { audit } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — CareerFair Admin" }, { name: "description", content: "Every change to events, with who and when." }] }),
  component: () => <RequireAdmin><AuditPage /></RequireAdmin>,
});

function AuditPage() {
  const { data: logs = [] } = useQuery({ queryKey: ["audit"], queryFn: audit });

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Every change to events, with who and when.</p>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => {
              const oldV = l.old_value as Record<string, unknown> | null | undefined;
              const newV = l.new_value as Record<string, unknown> | null | undefined;
              const changed = summarizeDiff(oldV, newV);
              return (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs">{format(new Date(l.timestamp), "dd MMM yyyy HH:mm")}</TableCell>
                  <TableCell className="text-sm">{l.user_name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{l.action}</Badge></TableCell>
                  <TableCell className="text-sm">{l.event_title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md">
                    {changed || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No activity yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function summarizeDiff(a?: Record<string, unknown> | null, b?: Record<string, unknown> | null) {
  if (!a || !b) return "";
  const keys = ["title", "date", "start_time", "end_time", "location", "capacity", "status", "registered_count"];
  const parts: string[] = [];
  for (const k of keys) {
    if (a[k] !== b[k]) parts.push(`${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
  }
  return parts.slice(0, 3).join(" · ");
}
