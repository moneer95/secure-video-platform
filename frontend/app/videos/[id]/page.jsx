const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "admin-demo-key";

async function getVideos() {
  const res = await fetch(`${API_BASE_URL}/api/videos`, {
    headers: { "x-api-key": ADMIN_KEY },
    cache: "no-store"
  });
  return res.json();
}

async function getEmbed(id) {
  const res = await fetch(`${API_BASE_URL}/api/videos/${id}/embed`, {
    method: "POST",
    headers: { "x-api-key": ADMIN_KEY, "content-type": "application/json" },
    body: JSON.stringify({})
  });
  return res.json();
}

export default async function VideoPage({ params }) {
  const { id } = await params;
  const data = await getVideos();
  const video = data.videos.find((v) => v.id === id);

  if (!video) {
    return <main className="container"><div className="card">Video not found.</div></main>;
  }

  let embed = null;
  if (video.status === "ready") {
    embed = await getEmbed(video.id);
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
