# Deployment Guide

## Prerequisites

- Docker & Docker Compose (for Postgres, MongoDB, Redis, MinIO, OpenSearch)
- Node.js 18+
- Domain with SSL certificate (production)

## Environment Setup

1. Copy the environment template and set secrets:

```bash
cp .env.example .env
# Edit .env and set:
# - JWT_SECRET (e.g. openssl rand -base64 32)
# - GITHUB_WEBHOOK_SECRET (e.g. openssl rand -hex 32)
# - Database URLs and S3/MinIO credentials
```

2. Required variables: `DATABASE_URL`, `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `NEXT_PUBLIC_APP_URL`. Optional: `GITHUB_*` for releases, `OPENSEARCH_URL` for search.

## Database Setup

```bash
# Start infrastructure (if using Docker Compose)
docker-compose up -d postgres mongodb redis minio opensearch

# Run Prisma migrations
npx prisma migrate deploy

# Ensure MongoDB indexes (run once)
npm run db:ensure-mongo-indexes
```

## Application Deployment

```bash
# Build
npm run build
npm run build:sdk   # if you need the SDK package

# Start Next.js
npm start

# Start the event worker (separate process)
npm run worker
```

Run the worker on at least one instance so events are processed from the queue.

## Health Check

```bash
curl https://your-domain/api/health
```

Returns 200 when Postgres, MongoDB, and Redis are healthy; 503 otherwise. Response includes `timestamp` and per-service `healthy`, `latencyMs`, and `error` (if any).

## Scaling

- **Horizontal**: Run multiple Next.js instances behind a load balancer. Run multiple worker instances; BullMQ uses Redis so jobs are distributed.
- **Database**: Ensure connection pooling for Postgres. MongoDB and Redis handle concurrent connections.

## Security

- Set security headers (handled by middleware: X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- Use HTTPS in production and set `NEXT_PUBLIC_APP_URL` to your public URL.
- Keep `.env` and `.env.local` out of version control.
