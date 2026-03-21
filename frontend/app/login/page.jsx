"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../_context/AuthContext";
import { apiFetch } from "../../lib/api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { refresh } = useAuth();
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    const key = password.trim();
    if (!key) {
      setError("Please enter the admin password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }
      await refresh();
      setLoading(false);
      router.replace("/");
    } catch {
      setError("Login failed. Check the backend is running.");
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="card" style={{ maxWidth: 400, margin: "40px auto" }}>
        <h1 className="title" style={{ fontSize: 24, marginBottom: 8 }}>Sign in</h1>
        <p className="small" style={{ marginBottom: 20 }}>Sign in with your admin password. A secure session cookie is set on the server.</p>
        <form onSubmit={onSubmit} className="list" style={{ gap: 16 }}>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            aria-label="Admin password"
            autoComplete="current-password"
            disabled={loading}
          />
          {error && (
            <p className="small" style={{ color: "var(--error, #dc2626)", margin: 0 }}>{error}</p>
          )}
          <button type="submit" className="btn btnPrimary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
