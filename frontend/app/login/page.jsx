"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../_context/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function LoginPage() {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setApiKey: setAuthKey } = useAuth();
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) {
      setError("Please enter the admin key.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid admin key");
        setLoading(false);
        return;
      }
      setAuthKey(key);
      router.replace("/");
    } catch (err) {
      setError("Login failed. Check the backend is running.");
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="card" style={{ maxWidth: 400, margin: "40px auto" }}>
        <h1 className="title" style={{ fontSize: 24, marginBottom: 8 }}>Sign in</h1>
        <p className="small" style={{ marginBottom: 20 }}>Enter your admin key to access the dashboard.</p>
        <form onSubmit={onSubmit} className="list" style={{ gap: 16 }}>
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Admin key"
            aria-label="Admin key"
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
