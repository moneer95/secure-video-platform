export default async function EmbedHelperPage({ params }) {
  const { id } = await params;
  return (
    <main className="container">
      <div className="card">
        <h1>Embed helper</h1>
        <p>Use the dashboard page for video ID: {id}</p>
      </div>
    </main>
  );
}
