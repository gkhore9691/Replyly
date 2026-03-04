# @replayly/fastify

Replayly plugin for Fastify applications.

## Installation

```bash
npm install @replayly/fastify @replayly/sdk
```

## Usage

```typescript
import Fastify from "fastify";
import replayly from "@replayly/fastify";

const fastify = Fastify();

await fastify.register(replayly, {
  apiKey: process.env.REPLAYLY_API_KEY!,
  environment: process.env.NODE_ENV,
  maskFields: ["password", "token"],
  captureHeaders: true,
  captureQuery: true,
  captureBody: true,
  captureResponse: true,
  ignoreRoutes: ["/health", "/metrics"],
});

fastify.get("/api/users", async (request, reply) => {
  return { users: [] };
});

await fastify.listen({ port: 3000 });
```

## Configuration

- `apiKey` - Your Replayly API key
- `environment` - Environment name (e.g. production, staging)
- `maskFields` - Array of field names to mask in requests/responses
- `captureHeaders` - Capture request headers (default: true)
- `captureQuery` - Capture query parameters (default: true)
- `captureBody` - Capture request body (default: true)
- `captureResponse` - Capture response (default: true)
- `ignoreRoutes` - Array of route path prefixes to ignore

## Accessing the client

```typescript
fastify.get("/api/custom", async (request, reply) => {
  const client = fastify.replayly;
  const context = request.replaylyContext ?? client.getContext();
  if (context) {
    fastify.replayly.breadcrumbs.add("Custom action");
  }
  return { success: true };
});
```
