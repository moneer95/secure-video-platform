"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../_context/AuthContext";
import { apiFetch } from "../../lib/api";

const DEFAULT_CATEGORY_NAMES = ["Tutorials", "Marketing", "Training", "Education", "Other"];

export default function UploadPage() {
  const { authenticated } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [categoryNames, setCategoryNames] = useState(DEFAULT_CATEGORY_NAMES);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!authenticated) return;
    apiFetch("/api/categories")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        const list = data.categories || [];
        const names = Array.isArray(list) && list.length > 0 ? list.map((c) => (typeof c === "string" ? c : c.name)) : DEFAULT_CATEGORY_NAMES;
        setCategoryNames(names);
      })
      .catch(() => {});
  }, [authenticated]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setMessage("Uploading and starting conversion...");

    const form = new FormData();
    form.append("title", title);
    form.append("category", category.trim());
    form.append("file", file);

    const res = await apiFetch("/api/upload", {
      method: "POST",
      body: form
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "Upload failed");
      return;
    }

    setMessage(`Uploaded. Video ID: ${data.id}. Processing started.`);
    setTimeout(() => router.push("/"), 1200);
  }

  return (
    <main className="container">
      <div className="card">
        <h1>Upload video</h1>
        <p className="small">Upload a raw MP4 and the backend will convert it automatically to protected HLS.</p>
        <form onSubmit={onSubmit} className="list" style={{ marginTop: 16 }}>
          <input type="text" placeholder="Video title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
          >
            <option value="">Select category</option>
            {categoryNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input type="file" accept="video/mp4" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button disabled={loading}>{loading ? "Uploading..." : "Upload and convert"}</button>
        </form>
        {message && <p style={{ marginTop: 16 }}>{message}</p>}
      </div>
    </main>
  );
}
