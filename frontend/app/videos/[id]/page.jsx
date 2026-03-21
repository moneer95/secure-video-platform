"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../_context/AuthContext";
import { apiFetch } from "../../../lib/api";

export default function VideoPage() {
  const params = useParams();
  const id = params?.id;
  const { authenticated } = useAuth();
  const [video, setVideo] = useState(null);
  const [embed, setEmbed] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !authenticated) return;
    setLoading(true);
    apiFetch("/api/videos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const v = data.videos?.find((x) => x.id === id);
        setVideo(v || null);
        if (v?.status === "ready") {
          return apiFetch(`/api/videos/${id}/embed`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
          }).then((res) => (res.ok ? res.json() : null));
        }
        return null;
      })
      .then((embedData) => setEmbed(embedData || null))
      .catch(() => setVideo(null))
      .finally(() => setLoading(false));
  }, [id, authenticated]);

  if (loading) {
    return (
      <main className="container">
        <div className="card"><div className="small">Loading…</div></div>
      </main>
    );
  }
  if (!video) {
    return (
      <main className="container">
        <div className="card">Video not found.</div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card">
        <h1>{video.title}</h1>
        <p className="small">Status: {video.status}</p>
        <p className="small">Original file: {video.original_name}</p>
      </div>

      {video.status === "ready" && embed && (
        <div className="grid grid-2" style={{ marginTop: 20 }}>
          <div className="card">
            <h3>Embed URL</h3>
            <pre>{embed.embedUrl}</pre>
          </div>
          <div className="card">
            <h3>Iframe code</h3>
            <pre>{embed.iframe}</pre>
          </div>
        </div>
      )}

      {video.status === "ready" && embed && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Preview</h3>
          <iframe
            src={embed.embedUrl}
            title="preview"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ width: "100%", aspectRatio: "16/9", border: 0, borderRadius: 16, overflow: "hidden" }}
          />
        </div>
      )}
    </main>
  );
}
