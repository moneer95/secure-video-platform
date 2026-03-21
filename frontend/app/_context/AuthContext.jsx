"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(null);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const r = await apiFetch("/api/auth/me");
      setAuthenticated(r.ok);
    } catch {
      setAuthenticated(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setAuthenticated(false);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const isLogin = pathname === "/login";
    if (!authenticated && !isLogin) {
      router.replace("/login");
    } else if (authenticated && isLogin) {
      router.replace("/");
    }
  }, [ready, authenticated, pathname, router]);

  const value = { authenticated, ready, logout, refresh };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
