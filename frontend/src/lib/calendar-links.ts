import type { CareerEvent } from "./types";

function toIcsDateTime(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

export function googleCalendarLink(ev: CareerEvent) {
  const start = toIcsDateTime(ev.date, ev.start_time);
  const end = toIcsDateTime(ev.date, ev.end_time);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    details: `${ev.description}\n\nRegister: ${ev.registration_url}`,
    location: `${ev.location}, ${ev.state}`,
    dates: `${start}/${end}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarLink(ev: CareerEvent) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    body: `${ev.description}\n\nRegister: ${ev.registration_url}`,
    location: `${ev.location}, ${ev.state}`,
    startdt: `${ev.date}T${ev.start_time}:00`,
    enddt: `${ev.date}T${ev.end_time}:00`,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
