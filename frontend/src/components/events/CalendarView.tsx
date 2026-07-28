import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { CareerEvent } from "@/lib/types";
import { useMemo, useRef } from "react";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "oklch(0.65 0.15 240)",
  full: "oklch(0.78 0.15 75)",
  completed: "oklch(0.55 0.03 250)",
  cancelled: "oklch(0.60 0.22 27)",
  deleted: "oklch(0.55 0.03 250)",
};

export function CalendarView({
  events,
  onEventClick,
  onEventDrop,
  editable = false,
  initialView = "dayGridMonth",
  onDateClick,
}: {
  events: CareerEvent[];
  onEventClick?: (ev: CareerEvent) => void;
  onEventDrop?: (id: string, newDate: string) => void;
  editable?: boolean;
  initialView?: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";
  onDateClick?: (date: string) => void;
}) {
  const ref = useRef<FullCalendar>(null);

  const mapped = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: `${e.date}T${e.start_time}`,
        end: `${e.date}T${e.end_time}`,
        backgroundColor: STATUS_COLORS[e.status] ?? STATUS_COLORS.scheduled,
        borderColor: STATUS_COLORS[e.status] ?? STATUS_COLORS.scheduled,
        extendedProps: { event: e },
      })),
    [events],
  );

  return (
    <div className="rounded-xl border bg-card p-2 sm:p-4 shadow-sm">
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth",
        }}
        buttonText={{
          today: "Today",
          month: "Month",
          week: "Week",
          day: "Day",
          list: "Agenda",
        }}
        events={mapped}
        editable={editable}
        eventStartEditable={editable}
        droppable={editable}
        fixedMirrorParent={typeof document !== "undefined" ? document.body : undefined}
        height="auto"
        dayMaxEvents={3}
        eventClick={(arg: EventClickArg) => {
          const ev = (arg.event.extendedProps as { event: CareerEvent }).event;
          onEventClick?.(ev);
        }}
        eventDrop={(arg: EventDropArg) => {
          if (!arg.event.start) return;
          const iso = arg.event.start.toISOString().slice(0, 10);
          onEventDrop?.(arg.event.id, iso);
        }}
        dateClick={(arg: DateClickArg) => onDateClick?.(arg.dateStr)}
      />
    </div>
  );
}
