# Replayly SDK – Express example

Minimal Express app using the Replayly SDK to capture requests and errors.

## Setup

1. From this directory: `npm install`
2. Build the SDK (from repo root): `npm run build:sdk`
3. Set `REPLAYLY_API_KEY` (from Replayly dashboard) and optionally `REPLAYLY_INGEST_URL` (e.g. `http://localhost:3000/api/ingest` for local app).

## Run

```bash
npm start
# or with env: REPLAYLY_API_KEY=rply_live_xxx npm start
```

Then open http://localhost:4000 and hit `/`, `/error`, or `POST /echo` with a JSON body. Events will appear in the Replayly dashboard (after the worker processes them).
