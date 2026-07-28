import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ragChat } from "@/lib/ai";
import { StatusBadge } from "@/components/events/StatusBadge";
import type { CareerEvent } from "@/lib/types";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/chatbot")({
  head: () => ({ meta: [{ title: "Ask AI — Career fair assistant" }, { name: "description", content: "Ask questions about career fairs and get grounded answers from the event database." }] }),
  component: ChatBot,
});

type Msg = { role: "user" | "assistant"; text: string; sources?: CareerEvent[] };

const STARTERS = [
  "What career fairs are available for software engineering students next month?",
  "When is the next event in Penang?",
  "Show me all Google-hosted events",
  "Any workshops at Universiti Malaya?",
];

function ChatBot() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi! I'm your career fair assistant. Ask about upcoming events, companies, universities, or locations.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim()) return;
    const q = text.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const r = await ragChat(q);
      setMessages((m) => [...m, { role: "assistant", text: r.answer, sources: r.sources }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, I couldn't reach the assistant. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageSquare className="h-5 w-5 text-primary" /> Ask AI
        </h1>
        <p className="text-sm text-muted-foreground">Answers grounded in the live event database (RAG).</p>
      </div>

      <Card className="flex h-[70vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={"max-w-[85%] rounded-2xl px-4 py-2.5 text-sm " + (m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-border/50 pt-2">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sources</div>
                    {m.sources.slice(0, 3).map((s) => (
                      <div key={s.id} className="rounded-md border bg-background p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-foreground">{s.title}</span>
                          <StatusBadge status={s.status} />
                        </div>
                        <div className="mt-0.5 text-muted-foreground">
                          {format(parseISO(s.date), "dd MMM yyyy")} · {s.location}, {s.state}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="inline h-4 w-4 animate-spin" /> thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && (
          <div className="border-t p-3">
            <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="h-3 w-3" /> Try asking</div>
            <div className="flex flex-wrap gap-1.5">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border bg-muted px-3 py-1 text-xs hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          className="flex items-center gap-2 border-t p-3"
          onSubmit={(e) => { e.preventDefault(); send(input); }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about career fairs, companies, universities…" />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
