"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAdminSession } from "@/lib/api/admin/session";
import type { AdminRole, AdminSession, Capability } from "@/lib/api/admin/types";

interface AdminSessionValue {
  session: AdminSession | null;
  loading: boolean;
  error: unknown;
  role: AdminRole;
  /** Hide UI the viewer can't use. The API still enforces every call. */
  can: (capability: Capability) => boolean;
  reload: () => void;
}

const Ctx = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    getAdminSession(user, profile?.role)
      .then((s) => alive && (setSession(s), setError(null)))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user, profile?.role, nonce]);

  const can = useCallback((c: Capability) => Boolean(session?.can.includes(c)), [session]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return <Ctx.Provider value={{ session, loading, error, role: session?.role ?? "moderator", can, reload }}>{children}</Ctx.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return v;
}
