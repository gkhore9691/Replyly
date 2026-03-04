# @replayly/sdk

Replayly SDK for Node.js — capture production request lifecycles (HTTP, DB, external calls, Redis) and send them to Replayly for replay and debugging.

## Installation

```bash
npm install @replayly/sdk
```

## Quick start (Express)

```javascript
const express = require("express");
const { ReplaylyClient, createExpressMiddleware } = require("@replayly/sdk");

const app = express();
app.use(express.json());

const replayly = new ReplaylyClient({
  apiKey: process.env.REPLAYLY_API_KEY,
  environment: "production",
  maskFields: ["password", "token"],
});

app.use(createExpressMiddleware(replayly));

app.get("/api/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await replayly.shutdown();
  process.exit(0);
});
```

## Configuration

| Option            | Type     | Default                         | Description                |
|------------------|----------|---------------------------------|----------------------------|
| `apiKey`         | string   | **required**                    | Replayly API key           |
| `projectId`      | string   | -                               | Project ID (optional)      |
| `endpoint`       | string   | `https://api.replayly.dev/ingest` | Ingestion URL            |
| `environment`    | string   | `process.env.NODE_ENV`          | Environment name           |
| `captureBody`    | boolean  | `true`                         | Capture request/response bodies |
| `captureHeaders` | boolean  | `true`                         | Capture headers            |
| `maxPayloadSize` | number   | `204800` (200KB)                | Max payload size (bytes)   |
| `sampleRate`     | number   | `1.0`                          | Sampling rate (0–1)        |
| `maskFields`     | string[] | `['password','token',...]`      | Fields to mask             |
| `captureAxios`   | boolean  | `true`                         | Instrument Axios           |
| `captureFetch`   | boolean  | `true`                         | Instrument fetch           |
| `captureMongo`   | boolean  | `true`                         | Instrument MongoDB          |
| `capturePostgres`| boolean  | `true`                         | Instrument PostgreSQL (pg)  |
| `captureRedis`   | boolean  | `true`                         | Instrument Redis (ioredis)  |

## PII masking

Configure additional fields to mask:

```javascript
const replayly = new ReplaylyClient({
  apiKey: process.env.REPLAYLY_API_KEY,
  maskFields: ["password", "creditCard", "ssn", "apiKey", "secret"],
});
```

Authorization and Cookie headers are always masked.

## Supported libraries

- **HTTP**: Express (middleware)
- **DB**: MongoDB (native driver), PostgreSQL (pg)
- **Cache**: Redis (ioredis)
- **HTTP client**: Axios, fetch

Install only the ones you use; instrumentation is optional and skipped if the package is not present.

## Framework packages

- **@replayly/fastify** — Fastify plugin (request/response/error capture)
- **@replayly/nextjs** — Next.js middleware and API route wrapper
- **@replayly/nestjs** — NestJS global module and interceptor

## Custom operations, breadcrumbs, and user context

```javascript
const replayly = new ReplaylyClient({ apiKey: "..." });
app.use(createExpressMiddleware(replayly));

app.get("/api/orders", async (req, res) => {
  replayly.setUser({ id: req.user.id, email: req.user.email });
  replayly.addBreadcrumb("Loading orders", { level: "info" });
  const result = await replayly.trackOperation("fetch_orders", async () => {
    return await Order.findMany();
  });
  res.json(result);
});
```

## ORM and protocol instrumentation

- **Prisma**: `instrumentPrisma(prisma, client)` — use after creating PrismaClient
- **Mongoose**: `instrumentMongoose(client)` — call once before defining models
- **TypeORM**: `createReplaylyTypeOrmLogger(client)` — pass as DataSource `logger` option
- **GraphQL**: `createGraphQLPlugin(client)` — add to Apollo Server `plugins`
- **WebSocket**: `instrumentWebSocket(wss, client)` — wrap your `ws` server
- **gRPC**: `createGRPCInterceptor(client)` — use with your gRPC client

## Performance

- SDK overhead: &lt; 100ms per request
- Async, non-blocking send
- Configurable sampling and payload limits

## Building

```bash
cd packages/sdk && npm install && npm run build
```
