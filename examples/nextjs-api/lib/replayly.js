const { ReplaylyClient } = require("@replayly/sdk");

const replayly = new ReplaylyClient({
  apiKey: process.env.REPLAYLY_API_KEY || "your_api_key",
  environment: process.env.NODE_ENV || "development",
  endpoint: process.env.REPLAYLY_INGEST_URL || "http://localhost:3000/api/ingest",
});

module.exports = { replayly };
