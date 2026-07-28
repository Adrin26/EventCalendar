import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "./types";
import { currentSession, login as apiLogin, signup as apiSignup, logout as apiLogout } from "./api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = currentSession();
    setUser(s?.user ?? null);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await apiLogin(email, password);
    setUser(r.user);
    return r.user;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const r = await apiSignup(name, email, password);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}

export function isAdmin(user: User | null) {
  return !!user && (user.role === "admin" || user.role === "superadmin" || user.role === "editor");
}
