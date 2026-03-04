export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Replayly Next.js example</h1>
      <p>
        <a href="/api/hello">GET /api/hello</a> – success
      </p>
      <p>
        <a href="/api/error">GET /api/error</a> – error (captured by SDK)
      </p>
    </main>
  );
}
