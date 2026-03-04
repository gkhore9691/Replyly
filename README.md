# Replayly

Distributed backend debugging platform — capture production request lifecycles and replay them locally.

## Phase 1: Foundation

This project includes:

- **Next.js 14** (App Router) with TypeScript
- **Docker Compose** for PostgreSQL, MongoDB, Redis, MinIO, OpenSearch
- **Authentication**: email/password, JWT, HTTP-only cookies
- **Multi-tenant**: Organizations and Projects with API key scoping
- **Dashboard**: shadcn/ui, sidebar, project settings, API key management

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
# Set JWT_SECRET (e.g. openssl rand -base64 32)
```

### 3. Start infrastructure

```bash
docker-compose up -d
# Wait for services: docker-compose ps
```

### 4. Database

```bash
npx prisma generate
npx prisma migrate deploy
# Optional: npm run db:seed
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, create an organization and project, then create an API key.

## Phase 3: Ingestion & Event Processing

- **Ingestion API**: `POST /api/ingest` — accepts batched events from the SDK (header: `x-replayly-api-key`). Validates API key, rate-limits per project, enqueues events to BullMQ.
- **Event worker**: Run `npm run worker` (or start the `worker` service via Docker Compose) to process the queue: store payloads in MinIO, metadata in MongoDB, analytics in PostgreSQL, and index in OpenSearch.
- **Health**: `GET /api/health` — returns status of Postgres, MongoDB, Redis, and queue metrics.

## Phase 8: Real-time & Alerting

- **WebSocket server**: Run `npm run ws` (default port 3001) for real-time event streaming. Set `NEXT_PUBLIC_WS_URL=ws://localhost:3001` and optionally `WS_PORT`.
- **Dashboard live mode**: On the project overview, use "Live on" to stream events in real time (requires WS server running).
- **CLI tail**: `replayly tail -p <projectId>` streams live events (requires WS server and `REPLAYLY_WS_URL`).
- **Alerts**: Create rules under **Settings → Manage Alerts**. Run `npm run worker:alerts` and `npm run worker:notifications` for evaluation and delivery.
- **Env**: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for email alerts; channel config (webhook URLs, etc.) is per rule.

## Scripts

- `npm run dev` — Start Next.js dev server
- `npm run build` — Production build
- `npm run worker` — Start the event processor worker (run after infra is up)
- `npm run worker:alerts` — Start the alert evaluation worker
- `npm run worker:notifications` — Start the notification delivery worker
- `npm run ws` — Start the WebSocket server for real-time streaming (port 3001)
- `npm run db:migrate` — Run Prisma migrations (interactive)
- `npm run db:studio` — Open Prisma Studio
- `npm run db:seed` — Seed demo user (demo@replayly.dev / demo123456)
- `npm run build:sdk` — Build the SDK package

## Environment variables

See `.env.example`. Required for local dev:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for signing JWTs
- `MONGODB_URI` — MongoDB connection string
- `REDIS_URL` — Redis connection string (queue and rate limiting)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION` — MinIO (S3-compatible) for raw payload storage
- `OPENSEARCH_URL` — OpenSearch for event search indexing

Optional for Phase 8:

- `WS_PORT`, `NEXT_PUBLIC_WS_URL` — WebSocket server for real-time
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — Email alerts (Resend)
