"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "admin-demo-key";
const DEFAULT_CATEGORY_NAMES = ["Tutorials", "Marketing", "Training", "Education", "Other"];

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function StatusBadge({ status }) {
  const s = String(status || "unknown").toLowerCase();
  const cls =
    s === "ready"
      ? "badge badgeGreen"
      : s === "processing"
        ? "badge badgeBlue"
        : s === "failed"
          ? "badge badgeRed"
          : "badge";
  return <span className={cls}>{s}</span>;
}

export default function VideoList({ videos }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(() => videos);
  const [deletingId, setDeletingId] = useState(null);
  const [copyingIframeId, setCopyingIframeId] = useState(null);
  const [categoryList, setCategoryList] = useState(() => DEFAULT_CATEGORY_NAMES.map((name) => ({ id: name, name, sort_order: 0 })));
  const [updatingCategoryId, setUpdatingCategoryId] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/categories`, { headers: { "x-api-key": ADMIN_KEY } })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        const list = data.categories || [];
        setCategoryList(Array.isArray(list) && list.length > 0 ? list : DEFAULT_CATEGORY_NAMES.map((name) => ({ id: name, name, sort_order: 0 })));
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((v) => {
      const title = (v.title || "").toLowerCase();
      const id = (v.id || "").toLowerCase();
      const status = (v.status || "").toLowerCase();
      const category = (v.category || "").toLowerCase();
      return title.includes(query) || id.includes(query) || status.includes(query) || category.includes(query);
    });
  }, [q, items]);

  return (
    <div className="list" style={{ gap: 12 }}>
      <div className="toolbar">
        <div className="toolbarLeft">
          <div className="kpi">
            <div className="kpiValue">{items.length}</div>
            <div className="kpiLabel">Total videos</div>
          </div>
        </div>
        <div className="toolbarRight">
          <input
            className="input"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, ID, category, or status…"
            aria-label="Search videos"
          />
        </div>
      </div>

      <div className="card tableCard">
        <div className="tableWrap" role="region" aria-label="Videos">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Title</th>
                <th style={{ width: "12%" }}>Category</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "10%" }}>Visits</th>
                <th style={{ width: "18%" }}>Created</th>
                <th style={{ width: "20%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="cellTitle">{v.title || "Untitled"}</div>
                    <div className="small mono">ID: {v.id}</div>
                  </td>
                  <td>
                    <select
                      className="selectCell"
                      value={v.category || ""}
                      disabled={updatingCategoryId === v.id}
                      onChange={async (e) => {
                        const newCategory = e.target.value;
                        setUpdatingCategoryId(v.id);
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/videos/${v.id}`, {
                            method: "PATCH",
                            headers: { "x-api-key": ADMIN_KEY, "content-type": "application/json" },
                            body: JSON.stringify({ category: newCategory })
                          });
                          if (!res.ok) throw new Error("Update failed");
                          setItems((cur) =>
                            cur.map((x) => (x.id === v.id ? { ...x, category: newCategory } : x))
                          );
                        } catch {
                          alert("Failed to update category");
                        } finally {
                          setUpdatingCategoryId(null);
                        }
                      }}
                      aria-label={`Category for ${v.title || v.id}`}
                    >
                      <option value="">—</option>
                      {categoryList.map((c) => (
                        <option key={c.id ?? c.name} value={c.name}>{c.name}</option>
                      ))}
                      {v.category && !categoryList.some((c) => c.name === v.category) && (
                        <option value={v.category}>{v.category}</option>
                      )}
                    </select>
                  </td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>
                    <div className="small" title="Embed page loads">{typeof v.view_count === "number" ? v.view_count.toLocaleString() : "0"}</div>
                  </td>
                  <td>
                    <div className="small">{formatDate(v.created_at)}</div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="actions">
                      <button
                        className="btn btnPrimary"
                        disabled={v.status !== "ready" || copyingIframeId === v.id}
                        title={v.status !== "ready" ? "Video must be ready to copy embed" : "Copy iframe embed code"}
                        onClick={async () => {
                          if (v.status !== "ready") return;
                          setCopyingIframeId(v.id);
                          try {
                            const res = await fetch(`${API_BASE_URL}/api/videos/${v.id}/embed`, {
                              method: "POST",
                              headers: { "x-api-key": ADMIN_KEY, "content-type": "application/json" },
                              body: JSON.stringify({})
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.error || "Failed to get embed");
                            await navigator.clipboard.writeText(data.iframe || "");
                            setTimeout(() => setCopyingIframeId(null), 1500);
                          } catch (e) {
                            alert(e?.message || "Failed to copy iframe");
                            setCopyingIframeId(null);
                          }
                        }}
                      >
                        {copyingIframeId === v.id ? "Copied!" : "Copy Video"}
                      </button>
                      <button
                        className="btn btnGhost"
                        disabled={deletingId === v.id}
                        onClick={async () => {
                          const ok = window.confirm(
                            `Are you sure you want to delete "${v.title || "Untitled"}" (${v.id})?\n\nThis will permanently remove the database record and all stored media files. This action cannot be undone.`
                          );
                          if (!ok) return;
                          setDeletingId(v.id);
                          try {
                            const res = await fetch(`${API_BASE_URL}/api/videos/${v.id}`, {
                              method: "DELETE",
                              headers: { "x-api-key": ADMIN_KEY }
                            });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              throw new Error(data?.error || `Delete failed (${res.status})`);
                            }
                            setItems((cur) => cur.filter((x) => x.id !== v.id));
                          } catch (e) {
                            alert(e?.message || "Delete failed");
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                      >
                        {deletingId === v.id ? "Deleting…" : "Delete"}
                      </button>
                      <Link href={`/videos/${v.id}`} className="btn btnGhost">
                        Manage
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      <div className="emptyTitle">No matching videos</div>
                      <div className="small">Try a different search.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {items.length === 0 && (
        <div className="card emptyCard">
          <div className="emptyTitle">No videos yet</div>
          <div className="small" style={{ marginTop: 6 }}>
            Upload an MP4 to automatically convert it to protected HLS and generate a signed embed link.
          </div>
        </div>
      )}
    </div>
  );
}

