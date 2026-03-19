"use client";
//test
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../_context/AuthContext";
import VideoList from "./VideoList";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function Dashboard() {
  const { apiKey, ready } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !apiKey) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/videos`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store"
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setVideos(Array.isArray(data?.videos) ? data.videos : []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [ready, apiKey]);

  if (!ready || !apiKey) return null;

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
