# Replayly — Technical System Design Document

## 1. System Overview

Replayly is a distributed backend debugging platform that captures production request lifecycles and enables deterministic local replay.

The system consists of:

1. SDK Layer (installed in customer app)
2. Ingestion API
3. Event Processing Pipeline
4. Storage Layer
5. Replay Engine
6. Dashboard API
7. CLI Tool
8. AI Assistance Layer (optional module)

Primary Design Goals:

* Minimal SDK overhead (<100ms)
* Horizontally scalable ingestion
* Multi-tenant isolation
* Cost-efficient storage
* Deterministic replay
* Secure by design (PII masking)

---

# 2. High-Level Architecture

```
Customer App
    ↓
Replayly SDK
    ↓
HTTPS (Async)
    ↓
Ingestion API (Fastify)
    ↓
Queue (Kafka / BullMQ)
    ↓
Event Processor Workers
    ↓
Storage Layer
    ├── MongoDB (Indexed metadata)
    ├── S3 (Raw payload storage)
    ├── Postgres (Analytics)
    └── OpenSearch (Search layer)
    ↓
Replay Engine
    ↓
CLI Tool / Dashboard
```

---

# 3. SDK Design

## 3.1 SDK Architecture

The SDK is middleware-based and framework-agnostic.

### Express Example

```
app.use(replaylyMiddleware({
  apiKey: "project_key",
  maskFields: ["password", "token"]
}))
```

## 3.2 SDK Responsibilities

* Capture request metadata
* Capture response data
* Capture stack trace (if error)
* Capture execution timing
* Attach correlation ID
* Mask sensitive fields
* Send async payload (non-blocking)

## 3.3 SDK Performance Constraints

* No blocking network calls
* Send via background async transport
* Payload size capped (default 200KB)
* Drop event if system under pressure

## 3.4 Data Captured

```
{
  projectId,
  environment,
  timestamp,
  method,
  url,
  headers,
  query,
  body,
  responseStatus,
  responseBody,
  stackTrace,
  durationMs,
  userId,
  gitCommitSha,
  correlationId
}
```

---

# 4. Ingestion Layer

## 4.1 API Server

Tech:

* Node.js
* Fastify
* TypeScript

Responsibilities:

* Validate API key
* Validate payload schema
* Rate limit per project
* Attach tenant metadata
* Push event to queue

## 4.2 Security

* API key hashed
* HMAC verification optional
* TLS required
* IP allowlist (enterprise tier)

---

# 5. Event Processing Pipeline

## 5.1 Queue Options

Early Stage:

* BullMQ + Redis

Scale Stage:

* Kafka

## 5.2 Worker Responsibilities

* Sanitize data
* Extract searchable fields
* Compress payload
* Store raw event in S3
* Store metadata in MongoDB
* Index searchable data in OpenSearch
* Trigger AI classification (async)

---

# 6. Storage Design

## 6.1 MongoDB (Metadata Store)

Collection: events

```
{
  _id,
  projectId,
  environment,
  route,
  statusCode,
  timestamp,
  durationMs,
  errorHash,
  s3Pointer,
  userId,
  gitCommitSha
}
```

Indexes:

* projectId + timestamp
* projectId + errorHash
* route
* statusCode

Purpose:
Fast filtering and dashboard listing.

---

## 6.2 S3 (Raw Payload Store)

Why:

* Cheaper than Mongo for large JSON
* Scalable
* Versioned

Stored as:

```
s3://bucket/projectId/eventId.json
```

Contains full request + response.

---

## 6.3 OpenSearch

Purpose:

* Full-text search
* Search by error message
* Search by payload content

---

## 6.4 Postgres (Analytics)

Stores:

* Daily event count
* Error frequency trends
* Deployment correlation data
* Retention stats

---

# 7. Replay Engine Design

Core differentiator.

## 7.1 Replay Flow

1. CLI requests event
2. Backend returns:

   * Raw event JSON
   * Replay config
3. CLI reconstructs request
4. Injects into local server

---

## 7.2 CLI Architecture

Node-based CLI tool:

```
replayly login
replayly replay --event-id=123
```

Steps:

* Authenticate user
* Fetch event JSON
* Map local port
* Send request to localhost server
* Print lifecycle trace

---

## 7.3 Replay Modes

### Dry Mode

* No external API calls
* Skip DB mutations

### Mock Mode

* Replace external calls with recorded responses

### Hybrid Mode

* Replay full request live

---

# 8. Intelligent Grouping System

## 8.1 Error Hashing

Generate deterministic error hash:

```
hash = SHA256(stackTrace + route)
```

Used for grouping similar errors.

## 8.2 AI Similarity Layer (Optional)

* Embed stack traces
* Cluster using cosine similarity
* Merge near-identical issues

---

# 9. Release Monitoring System

## 9.1 Git Integration

User connects GitHub.

On deploy:

* Webhook triggers release record

Store:

```
{
  projectId,
  version,
  commitSha,
  deployTime
}
```

Dashboard shows:

* Error spike after deploy
* Compare version A vs B

---

# 10. Multi-Tenant Architecture

Every entity contains:

```
projectId
organizationId
```

Isolation enforced:

* API layer
* DB query layer
* S3 path segmentation

Enterprise:

* Dedicated VPC deployment option

---

# 11. Scaling Strategy

## 11.1 Horizontal Scaling

* Stateless ingestion servers
* Autoscale via ECS
* Queue absorbs traffic spikes

## 11.2 Storage Optimization

* S3 lifecycle rules
* Event compression
* Configurable retention

## 11.3 Cost Control

* Event sampling option
* Drop large response bodies
* Partial capture mode

---

# 12. Security Architecture

## 12.1 Data Masking

SDK level masking rules:

```
maskFields: ["password", "creditCard"]
```

Regex-based PII detection (advanced tier).

## 12.2 Encryption

* TLS in transit
* AES-256 at rest
* KMS-managed keys

## 12.3 Compliance Roadmap

* SOC2 Type 1 → Type 2
* GDPR deletion support
* Audit logs

---

# 13. Observability of Replayly

Replayly monitors itself:

* Error ingestion failures
* Queue lag
* Worker crash rate
* Storage latency
* Replay success rate

Use:

* Prometheus
* Grafana
* CloudWatch

---

# 14. DevOps & Deployment

## 14.1 CI/CD

* GitHub Actions
* Docker containers
* Blue/Green deployments

## 14.2 Infrastructure

AWS Services:

* ECS (App)
* RDS (Postgres)
* Mongo Atlas
* S3
* OpenSearch
* Redis
* CloudFront

---

# 15. Performance Targets

* Ingestion latency < 50ms
* SDK overhead < 100ms
* Replay fetch < 1.5s
* Dashboard query < 500ms

---

# 16. Failure Handling

If ingestion fails:

* SDK retries
* Exponential backoff
* Drop event after N attempts

If queue overload:

* Backpressure logic
* Drop low-priority events

If S3 fails:

* Retry mechanism
* Dead letter queue

---

# 17. Future Enhancements

* Deterministic DB snapshot replay
* Distributed tracing
* Frontend + backend unified replay
* Edge deployment capture
* On-prem enterprise mode
* Plugin ecosystem

---

# 18. Key Engineering Risks

* Payload size explosion
* Replay nondeterminism
* Third-party API inconsistency
* Multi-region complexity
* Cost scaling too fast

Mitigation:

* Hard payload caps
* Configurable replay modes
* Sampling logic
* S3 lifecycle pruning

---

# 19. Technical North Star

Replayly must be:

* Lightweight
* Deterministic
* Developer-first
* Not bloated with observability noise
* Focused on replay speed

If feature does not improve debugging speed → do not build.

---

How will we read the DB queries, third-party API calls, their errors etc just by putting a single middleware? Can we do that I mean is it technically possible?

Very good question.

Now you’re thinking like an infra engineer, not a product guy.

Short answer:

👉 No — a single middleware cannot magically capture DB queries, third-party API calls, and async internals.

But…

👉 Yes — it is technically possible to capture most of it with a combination of instrumentation + async context propagation.

Let’s break this down properly.

1️⃣ What a Single Middleware CAN Capture

If you just do:

app.use(replaylyMiddleware())

You can reliably capture:

Request method

URL

Headers

Body

Response

Status code

Total duration

Stack trace (if error bubbles up)

User ID (if attached to req)

That’s easy.

But middleware alone CANNOT:

See Mongo queries

See SQL queries

See Axios/fetch calls

See Redis calls

See async background jobs

Capture internal function-level failures

Because those happen outside Express' lifecycle awareness.

2️⃣ How Big Players Actually Do It

Let’s talk about how tools like:

Datadog

New Relic

Elastic APM

capture DB + external calls.

They don’t rely on middleware.

They use:

Monkey patching + Async Context Tracking

3️⃣ The Real Technical Mechanism

There are 3 techniques:

✅ 1. Monkey Patching (Module Wrapping)

Example: intercept Mongo queries.

When someone does:

const mongoose = require("mongoose")

We wrap mongoose methods internally.

Example:

const originalExec = mongoose.Query.prototype.exec

mongoose.Query.prototype.exec = async function () {
  const start = Date.now()
  try {
    const result = await originalExec.apply(this, arguments)
    captureQuery(this.getQuery(), Date.now() - start)
    return result
  } catch (err) {
    captureQueryError(err)
    throw err
  }
}

Same for:

Axios

node-fetch

pg (Postgres)

mysql

Redis

This is how we intercept.

Is it hacky?
Yes.

Is it industry standard?
Also yes.

✅ 2. Async Context Tracking (Critical)

The big problem:

How do we associate:

A Mongo query

An Axios call

A Redis call

With the original HTTP request?

We use:

Node’s AsyncLocalStorage

Example:

const { AsyncLocalStorage } = require('async_hooks')
const asyncLocalStorage = new AsyncLocalStorage()

app.use((req, res, next) => {
  asyncLocalStorage.run({ requestId: uuid() }, () => {
    next()
  })
})

Now any async call can access:

asyncLocalStorage.getStore()

So when Mongo query runs:

We attach it to current request context.

This is how tracing works.

✅ 3. Instrumentation Hooks

Modern libraries provide hooks.

Example:

Mongo driver supports command monitoring:

client.on('commandStarted', event => {})

Axios interceptors:

axios.interceptors.request.use(...)

Postgres client wrapping.

This is cleaner than monkey patching.

4️⃣ So Is “Single Middleware” Realistic?

Honest answer:

❌ No — not alone.

What we do instead:

replayly.init({
  captureMongo: true,
  captureAxios: true,
  captureRedis: true
})

Under the hood:

Middleware sets request context

Instrumentation wraps supported libraries

AsyncLocalStorage ties everything together

From user POV:

Still looks like one setup line.

But internally it's much more.

5️⃣ What We CANNOT Do

There are limits.

We cannot:

Capture raw DB internal engine state

Capture queries from unsupported drivers

Guarantee deterministic race conditions

Replay distributed microservice behavior perfectly

Replay background jobs without instrumentation

So we must design around:

Partial determinism, not perfect determinism.

6️⃣ Third-Party API Calls — How?

Intercept:

Axios

node-fetch

https.request

fetch (Node 18+)

Wrap them:

const originalFetch = global.fetch
global.fetch = async (...args) => {
  const start = Date.now()
  try {
    const res = await originalFetch(...args)
    captureExternalCall(args[0], Date.now() - start)
    return res
  } catch (err) {
    captureExternalError(err)
    throw err
  }
}

That’s technically feasible.

7️⃣ But Here’s the Real Challenge

The hardest part is not capturing.

It’s replaying.

Because:

DB state changes

External APIs return different responses

Time-based logic changes

Randomness exists

So replay engine must:

Optionally mock external calls

Allow controlled environment

Not promise perfect determinism

8️⃣ So Is This Product Technically Possible?

Yes.

But with constraints.

What is realistic for V1:

✅ Capture request
✅ Capture response
✅ Capture DB queries (metadata)
✅ Capture external API calls
✅ Capture stack trace
✅ Provide structured replay

What is NOT realistic V1:

❌ Full DB snapshot restore
❌ Full distributed tracing
❌ Perfect race condition replay

9️⃣ Engineering Complexity Level

Middleware only → Easy
Instrumentation + Async context → Medium
Deterministic replay engine → Hard
Distributed replay across services → Very hard

This is why this product is powerful.

Because it sits at intersection of:

Observability

APM

Debugging

Dev tooling

10️⃣ Strategic Suggestion

For MVP:

Don’t capture everything.

Capture:

HTTP request

Stack trace

Axios calls

Mongo query metadata

That alone is insanely valuable.

Don’t aim for Datadog-level depth.

Aim for:

“80% of backend bugs reproducible in 1 click.”