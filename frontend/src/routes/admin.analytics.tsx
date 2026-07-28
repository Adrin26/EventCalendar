import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { aiAnalytics } from "@/lib/ai";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Sparkles, TrendingUp, MapPin, Building2, Target } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "AI Analytics — CareerFair Admin" }, { name: "description", content: "Attendance trends, popular locations, and AI recommendations." }] }),
  component: () => <RequireAdmin><AnalyticsPage /></RequireAdmin>,
});

function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["ai-analytics"], queryFn: aiAnalytics });

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <TrendingUp className="h-5 w-5 text-primary" /> AI Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Attendance trends, popular locations, and AI recommendations.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Monthly registrations</div>
          <ChartContainer config={{ registrations: { label: "Registrations", color: "var(--primary)" } }}>
            <LineChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="registrations" stroke="var(--color-registrations)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" /> Registrations by state</div>
          <ChartContainer config={{ registrations: { label: "Registrations", color: "var(--info)" } }}>
            <BarChart data={data.by_state}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="state" fontSize={11} />
              <YAxis fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="registrations" fill="var(--color-registrations)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Building2 className="h-4 w-4 text-primary" /> Top companies by registrations</div>
          <ChartContainer config={{ registrations: { label: "Registrations", color: "var(--primary)" } }}>
            <BarChart data={data.by_company.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="company" fontSize={11} />
              <YAxis fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="registrations" fill="var(--color-registrations)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Target className="h-4 w-4 text-primary" /> Top fill rates</div>
          <div className="space-y-2">
            {data.fill_rate.slice(0, 6).map((f) => (
              <div key={f.title} className="text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate">{f.title}</span>
                  <span className="text-xs text-muted-foreground">{f.rate}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, f.rate)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-info/5 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AI recommendations</div>
          <ul className="space-y-2 text-sm">
            {data.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
