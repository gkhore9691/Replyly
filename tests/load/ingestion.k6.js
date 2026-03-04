/**
 * k6 load test for the ingest API.
 * Run: k6 run -e API_KEY=rply_live_xxx tests/load/ingestion.k6.js
 * Or with env from file: k6 run --env API_KEY=$REPLAYLY_API_KEY tests/load/ingestion.k6.js
 */
import { check } from "k6/http";
import http from "k6/http";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.02"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const API_KEY = __ENV.API_KEY;
if (!API_KEY) {
  throw new Error("Set API_KEY env (e.g. k6 run -e API_KEY=rply_live_xxx tests/load/ingestion.k6.js)");
}

export default function () {
  const event = {
    events: [
      {
        requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date().toISOString(),
        method: "GET",
        url: "/api/test",
        statusCode: 200,
        durationMs: 50,
        isError: false,
        operations: { dbQueries: 0, externalCalls: 0, redisOps: 0 },
        operationDetails: { dbQueries: [], externalCalls: [], redisOps: [] },
        environment: "load-test",
        correlationId: `corr_${Date.now()}`,
      },
    ],
  };

  const res = http.post(`${BASE}/api/ingest`, JSON.stringify(event), {
    headers: {
      "Content-Type": "application/json",
      "X-Replayly-API-Key": API_KEY,
    },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "duration < 500ms": (r) => r.timings.duration < 500,
  });
}
