"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../_context/AuthContext";
import { apiFetch } from "../../lib/api";

export default function CategoriesPage() {
  const { authenticated } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  function load() {
    if (!authenticated) return;
    setLoading(true);
    apiFetch("/api/categories")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => setCategories(data.categories || []))
      .catch(() => setError("Failed to load categories"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (authenticated) load(); }, [authenticated]);

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setNewName("");
      setCategories((prev) => [...prev, data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    } catch (err) {
      setError(err.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit() {
    const name = editName.trim();
    if (!name || editingId == null) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/categories/${editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setCategories((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, name: data.name } : c))
      );
      cancelEdit();
    } catch (err) {
      setError(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this category? Videos using it will have their category cleared.")) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await apiFetch(`/api/categories/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="container">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">EA Dental Video Platform</div>
          <h1 className="title">Categories</h1>
          <div className="small">Manage video categories used in uploads and the video list.</div>
        </div>
        <div className="headerActions">
          <Link href="/" className="btn btnGhost">
            Back to videos
          </Link>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: "rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.08)" }}>
          <span className="small">{error}</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="small" style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Add category</h2>
        <form onSubmit={handleCreate} className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            aria-label="New category name"
            style={{ maxWidth: 280 }}
          />
          <button type="submit" className="btn btnPrimary" disabled={saving || !newName.trim()}>
            {saving ? "Adding…" : "Add"}
          </button>
        </form>
      </div>

      <div className="card tableCard">
        <div className="tableWrap" role="region" aria-label="Categories">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "60%" }}>Name</th>
                <th style={{ width: "40%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2}>
                    <div className="small">Loading…</div>
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={2}>
                    <div className="empty">
                      <div className="emptyTitle">No categories yet</div>
                      <div className="small">Add one above.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      {editingId === cat.id ? (
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                          <input
                            className="input"
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            style={{ maxWidth: 240 }}
                            autoFocus
                          />
                          <button type="button" className="btn btnPrimary" onClick={saveEdit} disabled={saving || !editName.trim()}>
                            Save
                          </button>
                          <button type="button" className="btn btnGhost" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="cellTitle" style={{ cursor: "pointer" }} onClick={() => startEdit(cat)}>
                          {cat.name}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {editingId !== cat.id && (
                        <>
                          <button type="button" className="btn btnGhost" onClick={() => startEdit(cat)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btnGhost"
                            disabled={deletingId === cat.id}
                            onClick={() => handleDelete(cat.id)}
                          >
                            {deletingId === cat.id ? "Deleting…" : "Delete"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
