"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

const STORAGE_KEY = "ea_dental_admin_key";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [apiKey, setApiKeyState] = useState(null);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    const envKey = process.env.NEXT_PUBLIC_ADMIN_KEY || "";
    setApiKeyState(stored || envKey || null);
    setReady(true);
  }, []);

  const setApiKey = useCallback((key) => {
    if (key) {
      window.sessionStorage.setItem(STORAGE_KEY, key);
      setApiKeyState(key);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
      setApiKeyState(null);
    }
  }, []);

  const logout = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const isLoginPage = pathname === "/login";
    if (!apiKey && !isLoginPage) {
      router.replace("/login");
    }
  }, [ready, apiKey, pathname, router]);

  const value = { apiKey, setApiKey, logout, ready };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
