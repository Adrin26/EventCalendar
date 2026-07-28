// Thin wrapper around AI endpoints on the FastAPI backend. Each function
// posts to /ai/* when a base URL is configured. Otherwise a lightweight
// on-device heuristic runs so preview features stay demonstrable.
import { http, isMockMode, cancelEvent, updateEvent, softDeleteEvent } from "./api";
import { mockApi } from "./mock-store";
import type { CareerEvent } from "./types";

export interface NLCommandPlan {
  intent: string;
  summary: string;
  actions: Array<{
    op: "update" | "cancel" | "delete" | "create";
    target_ids: string[];
    changes?: Partial<CareerEvent>;
  }>;
  affected_titles: string[];
}

export async function generateDescription(input: {
  title: string;
  company: string;
  university: string;
  industry: string;
  event_type: string;
}): Promise<string> {
  if (!isMockMode()) {
    try {
      const r = await http.post<{ description: string }>("/ai/description", input);
      return r.data.description;
    } catch { /* fall through */ }
  }
  return `Join ${input.company} at ${input.university} for an immersive ${input.event_type.replace("-", " ")} focused on ${input.industry.toLowerCase()} careers. Meet hiring managers, explore internship and graduate opportunities, and take part in on-the-spot interviews and portfolio reviews. Whether you're preparing for your first role or ready to level up, this session offers a direct line to real recruiters and practical guidance to accelerate your next career move.`;
}

export async function planNLCommand(command: string): Promise<NLCommandPlan> {
  if (!isMockMode()) {
    try {
      const r = await http.post<NLCommandPlan>("/ai/nl-command", { command });
      return r.data;
    } catch { /* fall through */ }
  }
  // Local heuristic parser (demo only).
  const c = command.toLowerCase();
  const events = mockApi.listEvents();
  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];

  const stateMatch = ["kuala lumpur","selangor","penang","johor","sabah","sarawak"].find((s) => c.includes(s));
  const uniMatch = events.map((e) => e.university).find((u) => c.includes(u.toLowerCase()));
  const companyMatch = events.map((e) => e.company).find((cp) => c.includes(cp.toLowerCase()));

  const targets = events.filter((e) => {
    if (stateMatch && e.state.toLowerCase() !== stateMatch) return false;
    if (uniMatch && e.university !== uniMatch) return false;
    if (companyMatch && e.company !== companyMatch) return false;
    if (c.includes("tomorrow")) {
      const t = new Date(); t.setDate(t.getDate() + 1);
      return e.date === t.toISOString().slice(0, 10);
    }
    if (c.includes("today")) return e.date === new Date().toISOString().slice(0, 10);
    return stateMatch || uniMatch || companyMatch;
  });

  if (c.includes("cancel")) {
    return {
      intent: "cancel",
      summary: `Cancel ${targets.length} event(s)${stateMatch ? ` in ${stateMatch}` : ""}${uniMatch ? ` at ${uniMatch}` : ""}.`,
      actions: [{ op: "cancel", target_ids: targets.map((e) => e.id) }],
      affected_titles: targets.map((e) => e.title),
    };
  }
  if (c.includes("move") || c.includes("reschedule")) {
    const targetMonthIdx = monthNames.findIndex((m) => c.includes(m));
    const now = new Date();
    let newMonth = c.includes("next month") ? now.getMonth() + 1 : (targetMonthIdx >= 0 ? targetMonthIdx : now.getMonth() + 1);
    let newYear = now.getFullYear();
    if (newMonth > 11) { newMonth -= 12; newYear += 1; }
    return {
      intent: "reschedule",
      summary: `Move ${targets.length} event(s) to ${monthNames[newMonth]} ${newYear}.`,
      actions: targets.map((e) => {
        const day = e.date.slice(8, 10);
        return {
          op: "update" as const,
          target_ids: [e.id],
          changes: { date: `${newYear}-${String(newMonth + 1).padStart(2, "0")}-${day}` },
        };
      }),
      affected_titles: targets.map((e) => e.title),
    };
  }
  return {
    intent: "unknown",
    summary: `I couldn't confidently interpret that command. Try: "Cancel tomorrow's event at UTM" or "Move all Johor events to next month".`,
    actions: [],
    affected_titles: [],
  };
}

export async function applyNLPlan(plan: NLCommandPlan, user: import("./types").User | null) {
  for (const a of plan.actions) {
    for (const id of a.target_ids) {
      if (a.op === "cancel") await cancelEvent(id, user);
      else if (a.op === "update" && a.changes) await updateEvent(id, a.changes, user, "ai-updated");
      else if (a.op === "delete") await softDeleteEvent(id, user);
    }
  }
}

export interface ChatAnswer {
  answer: string;
  sources: CareerEvent[];
}
export async function ragChat(question: string): Promise<ChatAnswer> {
  if (!isMockMode()) {
    try {
      const r = await http.post<ChatAnswer>("/ai/chat", { question });
      return r.data;
    } catch { /* fall through */ }
  }
  const sources = mockApi.searchEvents(question);
  if (sources.length === 0) {
    return {
      answer: "I couldn't find any matching events. Try asking about a state, company, university or industry — for example: 'career fairs in Penang next month'.",
      sources: [],
    };
  }
  const first = sources[0];
  const list = sources
    .slice(0, 4)
    .map((e) => `• ${e.title} — ${e.university}, ${e.state} on ${e.date} (${e.start_time}–${e.end_time})`)
    .join("\n");
  return {
    answer: `I found ${sources.length} event${sources.length > 1 ? "s" : ""} that could match. Here are the top results:\n\n${list}\n\nThe closest one is "${first.title}" at ${first.location}. You can open it from the calendar to register.`,
    sources,
  };
}

export interface AiAnalytics {
  by_state: { state: string; count: number; registrations: number }[];
  by_company: { company: string; count: number; registrations: number }[];
  fill_rate: { title: string; rate: number }[];
  monthly: { month: string; events: number; registrations: number }[];
  recommendations: string[];
}
export async function aiAnalytics(): Promise<AiAnalytics> {
  if (!isMockMode()) {
    try { return (await http.get<AiAnalytics>("/ai/analytics")).data; } catch { /* fall */ }
  }
  const events = mockApi.listEvents();
  const groupBy = <K extends string>(key: (e: CareerEvent) => K) => {
    const m = new Map<K, { count: number; registrations: number }>();
    for (const e of events) {
      const k = key(e);
      const cur = m.get(k) ?? { count: 0, registrations: 0 };
      cur.count += 1; cur.registrations += e.registered_count;
      m.set(k, cur);
    }
    return m;
  };
  const byS = groupBy((e) => e.state);
  const byC = groupBy((e) => e.company);
  const monthly = groupBy((e) => e.date.slice(0, 7) as string);

  const by_state = [...byS].map(([state, v]) => ({ state, ...v })).sort((a, b) => b.registrations - a.registrations);
  const by_company = [...byC].map(([company, v]) => ({ company, ...v })).sort((a, b) => b.registrations - a.registrations);
  const fill_rate = events
    .map((e) => ({ title: e.title, rate: Math.round((e.registered_count / Math.max(e.capacity, 1)) * 100) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);
  const monthlyArr = [...monthly].map(([month, v]) => ({ month, events: v.count, registrations: v.registrations })).sort((a, b) => a.month.localeCompare(b.month));

  const top = by_state[0]; const worst = fill_rate[fill_rate.length - 1];
  const recommendations = [
    top ? `Concentrate marketing spend on ${top.state}, which drives the highest registrations (${top.registrations}).` : "Collect more data to identify top-performing regions.",
    worst ? `Consider repositioning or promoting "${worst.title}" — it has the lowest fill rate (${worst.rate}%).` : "",
    by_company[0] ? `${by_company[0].company} events consistently outperform on registrations — explore an extended partnership.` : "",
    "Bundle same-day, same-university sessions with different industries to raise cross-audience attendance.",
  ].filter(Boolean);

  return { by_state, by_company, fill_rate, monthly: monthlyArr, recommendations };
}
