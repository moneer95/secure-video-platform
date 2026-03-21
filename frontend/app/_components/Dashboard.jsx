"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../_context/AuthContext";
import VideoList from "./VideoList";
import { apiFetch } from "../../lib/api";

export default function Dashboard() {
  const { authenticated, ready } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !authenticated) return;
    setLoading(true);
    apiFetch("/api/videos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setVideos(Array.isArray(data?.videos) ? data.videos : []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [ready, authenticated]);

  if (!ready || !authenticated) return null;

  return (
    <main className="container">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">EA Dental Video Platform</div>
          <h1 className="title">Videos</h1>
          <div className="small">Upload, convert, and generate protected embeds.</div>
        </div>
        <div className="headerActions">
          <Link href="/upload" className="btn btnPrimary">
            Upload video
          </Link>
        </div>
      </div>
      {loading ? (
        <div className="card">
          <div className="small">Loading videos…</div>
        </div>
      ) : (
        <VideoList videos={videos} />
      )}
    </main>
  );
}
