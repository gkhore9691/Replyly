/**
 * Example: Express app with Replayly SDK
 * Run from repo root after building the SDK:
 *   cd packages/sdk && npm run build
 *   node examples/express-app/index.js
 * Or link the SDK: npm link ../../packages/sdk (then use require('@replayly/sdk'))
 */
const express = require("express");
const path = require("path");

// When SDK is built and linked or run from packages/sdk:
let ReplaylyClient;
let createExpressMiddleware;
try {
  const sdk = require("../../dist/index.js");
  ReplaylyClient = sdk.ReplaylyClient;
  createExpressMiddleware = sdk.createExpressMiddleware;
} catch {
  console.log("Run from packages/sdk: node examples/express-app/index.js");
  process.exit(1);
}

const app = express();
app.use(express.json());

const replayly = new ReplaylyClient({
  apiKey: process.env.REPLAYLY_API_KEY || "your-api-key",
  endpoint: process.env.REPLAYLY_ENDPOINT || "http://localhost:3000/api/ingest",
  environment: "development",
  maskFields: ["password"],
});

app.use(createExpressMiddleware(replayly));

app.get("/", (req, res) => {
  res.json({ message: "Replayly Express example" });
});

app.get("/api/users", (req, res) => {
  res.json({ users: [] });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Example app listening on http://localhost:${PORT}`);
});
