const express = require("express");
const { ReplaylyClient, createExpressMiddleware } = require("@replayly/sdk");

const app = express();
app.use(express.json());

const replayly = new ReplaylyClient({
  apiKey: process.env.REPLAYLY_API_KEY || "your_api_key",
  environment: process.env.NODE_ENV || "development",
  endpoint: process.env.REPLAYLY_INGEST_URL || "http://localhost:3000/api/ingest",
  maskFields: ["password", "token"],
});

app.use(createExpressMiddleware(replayly));

app.get("/", (req, res) => res.json({ ok: true }));
app.get("/error", (req, res) => {
  throw new Error("Example error for Replayly");
});
app.post("/echo", (req, res) => res.json(req.body));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Example Express server at http://localhost:${PORT}`);
});

process.on("SIGTERM", async () => {
  await replayly.shutdown();
  process.exit(0);
});
