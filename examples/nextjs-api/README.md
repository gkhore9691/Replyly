# Replayly SDK – Next.js API example

Minimal Next.js app with an API route that uses the Replayly SDK to capture request/response and errors.

## Setup

1. From this directory: `npm install`
2. Build the SDK (from repo root): `npm run build:sdk`
3. Set `REPLAYLY_API_KEY` and optionally `REPLAYLY_INGEST_URL` in `.env.local`.

## Run

```bash
npm run dev
```

Open http://localhost:4001/api/hello and http://localhost:4001/api/error. Events will show in the Replayly dashboard.
