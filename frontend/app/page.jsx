import Link from "next/link";
import VideoList from "./_components/VideoList.jsx";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "admin-demo-key";

async function getVideos() {
  const res = await fetch(`${API_BASE_URL}/api/videos`, {
    headers: { "x-api-key": ADMIN_KEY },
    cache: "no-store"
  });
  return res.json();
}

export default async function HomePage() {
  const data = await getVideos();
  const videos = Array.isArray(data?.videos) ? data.videos : [];

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

      <VideoList videos={videos} />
    </main>
  );
}
