import { Navigate } from "@tanstack/react-router";
import { useAuth, isAdmin } from "@/lib/auth";
import type { ReactNode } from "react";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin(user)) return <Navigate to="/admin/login" />;
  return <>{children}</>;
}
