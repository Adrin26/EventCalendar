export type Role = "superadmin" | "admin" | "editor" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export type EventStatus =
  | "scheduled"
  | "full"
  | "completed"
  | "cancelled"
  | "deleted";

export type EventType =
  | "career-fair"
  | "recruitment-drive"
  | "workshop"
  | "networking"
  | "webinar";

export interface CareerEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  state: string;
  university: string;
  company: string;
  industry: string;
  event_type: EventType;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  capacity: number;
  registered_count: number;
  status: EventStatus;
  registration_url: string;
  organiser: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface AuditLog {
  id: string;
  event_id: string;
  event_title: string;
  user_id: string;
  user_name: string;
  action: string;
  old_value?: unknown;
  new_value?: unknown;
  timestamp: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DashboardStats {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  this_month: number;
  total_registrations: number;
}
