// Axios client that talks to a FastAPI backend when VITE_API_BASE_URL is set
// and reachable; otherwise falls back to the localStorage-backed mock so the
// preview stays fully interactive. Every function returns the same shape
// regardless of source.
import axios, { AxiosError } from "axios";
import type {
  AuditLog,
  AuthResponse,
  CareerEvent,
  DashboardStats,
  User,
} from "./types";
import { mockApi } from "./mock-store";

const BASE_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_API_BASE_URL ?? "";

export const isMockMode = () => !BASE_URL;

export const http = axios.create({
  baseURL: BASE_URL || "/api",
  // Ollama-backed /ai/* calls can take well over the default 15s; keep in sync
  // with backend OLLAMA_TIMEOUT_SECONDS (180).
  timeout: 180_000,
});

http.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const sess = mockApi.session();
    if (sess?.token) config.headers.Authorization = `Bearer ${sess.token}`;
  }
  return config;
});

// Helper: try live backend, fall back to mock on network error / 404
async function tryLive<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
  if (isMockMode()) return fallback();
  try {
    return await fn();
  } catch (err) {
    const ax = err as AxiosError;
    if (!ax.response || ax.code === "ERR_NETWORK") return fallback();
    throw err;
  }
}

// ===== Auth =====
function persistSession(session: AuthResponse | null) {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem("cf.session", JSON.stringify(session));
  else localStorage.removeItem("cf.session");
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return tryLive(
    async () => {
      const data = (await http.post<AuthResponse>("/auth/login", { email, password })).data;
      persistSession(data);
      return data;
    },
    () => mockApi.login({ email, password }),
  );
}
export async function signup(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return tryLive(
    async () => {
      const data = (await http.post<AuthResponse>("/auth/signup", { name, email, password })).data;
      persistSession(data);
      return data;
    },
    () => mockApi.signup({ name, email, password }),
  );
}
export function currentSession(): AuthResponse | null {
  return mockApi.session();
}
export function logout() {
  mockApi.logout();
  persistSession(null);
}

// ===== Events =====
export async function listEvents(opts?: { includeDeleted?: boolean }): Promise<CareerEvent[]> {
  return tryLive(
    async () => (await http.get<CareerEvent[]>("/events", { params: opts })).data,
    () => mockApi.listEvents(opts),
  );
}
export async function getEvent(id: string): Promise<CareerEvent | undefined> {
  return tryLive(
    async () => (await http.get<CareerEvent>(`/events/${id}`)).data,
    () => mockApi.getEvent(id),
  );
}
export async function createEvent(
  input: Parameters<typeof mockApi.createEvent>[0],
  user: User | null,
): Promise<CareerEvent> {
  return tryLive(
    async () => (await http.post<CareerEvent>("/events", input)).data,
    () => mockApi.createEvent(input, user),
  );
}
export async function updateEvent(
  id: string,
  patch: Partial<CareerEvent>,
  user: User | null,
  action = "updated",
): Promise<CareerEvent> {
  return tryLive(
    async () => (await http.patch<CareerEvent>(`/events/${id}`, { ...patch, action })).data,
    () => mockApi.updateEvent(id, patch, user, action),
  );
}
export async function duplicateEvent(id: string, user: User | null) {
  return tryLive(
    async () => (await http.post<CareerEvent>(`/events/${id}/duplicate`)).data,
    () => mockApi.duplicateEvent(id, user),
  );
}
export async function cancelEvent(id: string, user: User | null) {
  return updateEvent(id, { status: "cancelled" }, user, "cancelled");
}
export async function restoreEvent(id: string, user: User | null) {
  return updateEvent(id, { status: "scheduled", deleted_at: null }, user, "restored");
}
export async function softDeleteEvent(id: string, user: User | null) {
  return updateEvent(
    id,
    { status: "deleted", deleted_at: new Date().toISOString() },
    user,
    "soft-deleted",
  );
}

export async function findConflicts(input: {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string;
  university?: string;
}): Promise<CareerEvent[]> {
  return tryLive(
    async () =>
      (await http.post<CareerEvent[]>("/events/conflicts", input)).data,
    () => mockApi.findConflicts(input),
  );
}

export async function stats(): Promise<DashboardStats> {
  return tryLive(
    async () => (await http.get<DashboardStats>("/stats")).data,
    () => mockApi.stats(),
  );
}

export async function audit(): Promise<AuditLog[]> {
  return tryLive(
    async () => (await http.get<AuditLog[]>("/audit")).data,
    () => mockApi.audit(),
  );
}
