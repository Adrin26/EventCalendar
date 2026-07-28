// Browser-only localStorage-backed store used as a fallback when a live
// FastAPI backend isn't reachable. Keeps the preview fully functional.
import type {
  AuditLog,
  AuthResponse,
  CareerEvent,
  DashboardStats,
  EventStatus,
  User,
} from "./types";

const K_USERS = "cf.users";
const K_EVENTS = "cf.events";
const K_AUDIT = "cf.audit";
const K_SESSION = "cf.session";

const isBrowser = () => typeof window !== "undefined";

function uid() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, val: T) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(val));
}

function seedIfEmpty() {
  if (!isBrowser()) return;
  if (localStorage.getItem(K_EVENTS)) return;

  const now = new Date();
  const y = now.getFullYear();
  const month = (m: number) =>
    `${y}-${String(m).padStart(2, "0")}`;

  const universities = [
    "Universiti Malaya",
    "Universiti Teknologi Malaysia",
    "Universiti Sains Malaysia",
    "Sunway University",
    "Taylor's University",
    "INTI International University",
    "Multimedia University",
  ];
  const companies = [
    "Google",
    "Microsoft",
    "Shopee",
    "Grab",
    "Maybank",
    "Petronas",
    "AirAsia",
    "Talentbank",
  ];
  const states = [
    "Kuala Lumpur",
    "Selangor",
    "Penang",
    "Johor",
    "Sabah",
    "Sarawak",
  ];
  const industries = [
    "Technology",
    "Finance",
    "Energy",
    "Aviation",
    "Consulting",
    "Retail",
  ];
  const types = [
    "career-fair",
    "recruitment-drive",
    "workshop",
    "networking",
    "webinar",
  ] as const;

  const events: CareerEvent[] = [];
  for (let i = 0; i < 42; i++) {
    const m = 1 + Math.floor(Math.random() * 12);
    const d = 1 + Math.floor(Math.random() * 27);
    const uni = universities[i % universities.length];
    const co = companies[i % companies.length];
    const state = states[i % states.length];
    const industry = industries[i % industries.length];
    const type = types[i % types.length];
    const capacity = 50 + Math.floor(Math.random() * 500);
    const registered = Math.floor(Math.random() * capacity * 1.05);
    const date = `${month(m)}-${String(d).padStart(2, "0")}`;
    const startHour = 9 + Math.floor(Math.random() * 5);
    const evDate = new Date(`${date}T00:00:00`);
    let status: EventStatus = "scheduled";
    if (evDate < new Date(new Date().toDateString())) status = "completed";
    if (registered >= capacity) status = "full";
    events.push({
      id: uid(),
      title: `${co} × ${uni} ${type === "career-fair" ? "Career Fair" : type.replace("-", " ")}`,
      description: `Meet recruiters from ${co} at ${uni}. Explore graduate roles, internships and networking opportunities across ${industry.toLowerCase()}.`,
      location: `${uni} Main Hall`,
      state,
      university: uni,
      company: co,
      industry,
      event_type: type,
      date,
      start_time: `${String(startHour).padStart(2, "0")}:00`,
      end_time: `${String(startHour + 3).padStart(2, "0")}:00`,
      capacity,
      registered_count: Math.min(registered, capacity),
      status,
      registration_url: "https://talentbank.com.my/register",
      organiser: co,
      created_by: "seed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
  }
  write(K_EVENTS, events);
  write(K_USERS, [] as User[]);
  write(K_AUDIT, [] as AuditLog[]);
}

seedIfEmpty();

function getEvents(): CareerEvent[] {
  return read<CareerEvent[]>(K_EVENTS, []);
}
function setEvents(list: CareerEvent[]) {
  write(K_EVENTS, list);
}
function getUsers(): (User & { password: string })[] {
  return read<(User & { password: string })[]>(K_USERS, []);
}
function setUsers(list: (User & { password: string })[]) {
  write(K_USERS, list);
}
function getAudit(): AuditLog[] {
  return read<AuditLog[]>(K_AUDIT, []);
}
function setAudit(list: AuditLog[]) {
  write(K_AUDIT, list);
}

function logAction(
  ev: CareerEvent | { id: string; title: string },
  user: User | null,
  action: string,
  old_value?: unknown,
  new_value?: unknown,
) {
  const list = getAudit();
  list.unshift({
    id: uid(),
    event_id: ev.id,
    event_title: ev.title,
    user_id: user?.id ?? "system",
    user_name: user?.name ?? "System",
    action,
    old_value: old_value ?? null,
    new_value: new_value ?? null,
    timestamp: new Date().toISOString(),
  });
  setAudit(list.slice(0, 500));
}

function recomputeStatuses() {
  const today = new Date().toISOString().slice(0, 10);
  const list = getEvents().map((e) => {
    if (e.status === "cancelled" || e.status === "deleted") return e;
    let status: EventStatus = e.status;
    if (e.date < today) status = "completed";
    else if (e.registered_count >= e.capacity) status = "full";
    else status = "scheduled";
    return status !== e.status ? { ...e, status } : e;
  });
  setEvents(list);
}

export const mockApi = {
  // --- Auth
  signup(input: { name: string; email: string; password: string }): AuthResponse {
    const users = getUsers();
    if (users.find((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("Email already registered");
    }
    const role = users.length === 0 ? "superadmin" : "viewer";
    const u: User & { password: string } = {
      id: uid(),
      name: input.name,
      email: input.email,
      password: input.password,
      role,
      created_at: new Date().toISOString(),
    };
    users.push(u);
    setUsers(users);
    const token = `mock.${u.id}.${Date.now()}`;
    const session = { token, user: stripPw(u) };
    write(K_SESSION, session);
    return session;
  },
  login(input: { email: string; password: string }): AuthResponse {
    const users = getUsers();
    const u = users.find(
      (x) =>
        x.email.toLowerCase() === input.email.toLowerCase() &&
        x.password === input.password,
    );
    if (!u) throw new Error("Invalid email or password");
    const token = `mock.${u.id}.${Date.now()}`;
    const session = { token, user: stripPw(u) };
    write(K_SESSION, session);
    return session;
  },
  session(): AuthResponse | null {
    return read<AuthResponse | null>(K_SESSION, null);
  },
  logout() {
    if (isBrowser()) localStorage.removeItem(K_SESSION);
  },
  listUsers(): User[] {
    return getUsers().map(stripPw);
  },

  // --- Events
  listEvents(opts?: { includeDeleted?: boolean }): CareerEvent[] {
    recomputeStatuses();
    const list = getEvents();
    return opts?.includeDeleted ? list : list.filter((e) => e.status !== "deleted");
  },
  getEvent(id: string): CareerEvent | undefined {
    return getEvents().find((e) => e.id === id);
  },
  createEvent(
    input: Omit<CareerEvent, "id" | "created_at" | "updated_at" | "status" | "registered_count" | "deleted_at">,
    user: User | null,
  ): CareerEvent {
    const ev: CareerEvent = {
      ...input,
      id: uid(),
      registered_count: 0,
      status: "scheduled",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      created_by: user?.id ?? "system",
    };
    const list = getEvents();
    list.push(ev);
    setEvents(list);
    logAction(ev, user, "created", null, ev);
    return ev;
  },
  updateEvent(
    id: string,
    patch: Partial<CareerEvent>,
    user: User | null,
    action = "updated",
  ): CareerEvent {
    const list = getEvents();
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error("Event not found");
    const old = list[idx];
    const next: CareerEvent = { ...old, ...patch, updated_at: new Date().toISOString() };
    list[idx] = next;
    setEvents(list);
    logAction(next, user, action, old, next);
    return next;
  },
  duplicateEvent(id: string, user: User | null): CareerEvent {
    const src = mockApi.getEvent(id);
    if (!src) throw new Error("Not found");
    const copy = {
      ...src,
      title: `${src.title} (Copy)`,
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at, updated_at, status, registered_count, deleted_at, ...rest } = copy;
    return mockApi.createEvent(rest, user);
  },
  cancelEvent(id: string, user: User | null) {
    return mockApi.updateEvent(id, { status: "cancelled" }, user, "cancelled");
  },
  restoreEvent(id: string, user: User | null) {
    return mockApi.updateEvent(id, { status: "scheduled", deleted_at: null }, user, "restored");
  },
  softDeleteEvent(id: string, user: User | null) {
    return mockApi.updateEvent(
      id,
      { status: "deleted", deleted_at: new Date().toISOString() },
      user,
      "soft-deleted",
    );
  },

  // --- Conflicts
  findConflicts(
    input: {
      id?: string;
      date: string;
      start_time: string;
      end_time: string;
      location?: string;
      university?: string;
    },
  ): CareerEvent[] {
    const list = mockApi.listEvents();
    return list.filter((e) => {
      if (e.id === input.id) return false;
      if (e.date !== input.date) return false;
      const overlap =
        input.start_time < e.end_time && input.end_time > e.start_time;
      if (!overlap) return false;
      const sameVenue = input.location && e.location === input.location;
      const sameUni = input.university && e.university === input.university;
      return Boolean(sameVenue || sameUni);
    });
  },

  // --- Stats
  stats(): DashboardStats {
    const list = mockApi.listEvents();
    const today = new Date().toISOString().slice(0, 10);
    const monthPrefix = new Date().toISOString().slice(0, 7);
    return {
      total: list.length,
      upcoming: list.filter(
        (e) => e.date >= today && e.status !== "cancelled",
      ).length,
      completed: list.filter((e) => e.status === "completed").length,
      cancelled: list.filter((e) => e.status === "cancelled").length,
      this_month: list.filter((e) => e.date.startsWith(monthPrefix)).length,
      total_registrations: list.reduce((s, e) => s + e.registered_count, 0),
    };
  },

  // --- Audit
  audit(): AuditLog[] {
    return getAudit();
  },

  // --- Simple RAG-like search for chatbot
  searchEvents(query: string): CareerEvent[] {
    const q = query.toLowerCase();
    return mockApi
      .listEvents()
      .filter((e) =>
        [e.title, e.description, e.company, e.university, e.state, e.location, e.industry, e.event_type]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 6);
  },
};

function stripPw(u: User & { password: string }): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = u;
  return rest;
}
