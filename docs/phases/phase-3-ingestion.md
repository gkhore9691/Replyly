# Phase 3: Ingestion API & Event Processing

## Overview

Build the ingestion pipeline that receives events from the SDK, validates them, queues them for processing, and stores them across multiple data stores (MongoDB, MinIO, PostgreSQL, OpenSearch) with proper multi-tenant isolation.

**Duration Estimate**: Core backend infrastructure  
**Priority**: Critical - Required for Phase 4  
**Dependencies**: Phase 1 (infrastructure), Phase 2 (SDK sending events)

---

## Goals

1. Build ingestion API endpoint (`/api/ingest`)
2. Implement API key validation and rate limiting
3. Set up BullMQ queue for event processing
4. Build event processor worker
5. Implement storage pipeline:
   - Store raw payloads in MinIO (S3-compatible)
   - Store metadata in MongoDB
   - Store analytics in PostgreSQL
   - Index searchable data in OpenSearch
6. Ensure multi-tenant isolation at all layers
7. Handle failures gracefully with retry logic

---

## Technical Architecture

### System Flow

```mermaid
graph LR
    SDK[SDK Client]
    API[Ingestion API]
    Queue[BullMQ Queue]
    Worker[Event Processor]
    Mongo[(MongoDB)]
    MinIO[(MinIO S3)]
    Postgres[(PostgreSQL)]
    Search[(OpenSearch)]
    
    SDK -->|POST /api/ingest| API
    API -->|Validate & Enqueue| Queue
    Queue -->|Process Job| Worker
    Worker -->|Store Metadata| Mongo
    Worker -->|Store Payload| MinIO
    Worker -->|Store Analytics| Postgres
    Worker -->|Index Search| Search
```

---

## Ingestion API

### Endpoint: POST /api/ingest

**Location:** `app/api/ingest/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key'
import { eventQueue } from '@/lib/queue/event-queue'
import { rateLimiter } from '@/lib/rate-limit'
import { z } from 'zod'

// Event schema validation
const EventSchema = z.object({
  projectId: z.string().optional(),
  requestId: z.string(),
  timestamp: z.string(),
  durationMs: z.number(),
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string()),
  query: z.any().optional(),
  body: z.any().optional(),
  statusCode: z.number(),
  responseBody: z.any().optional(),
  isError: z.boolean(),
  error: z.object({
    message: z.string(),
    name: z.string(),
    stack: z.string().optional(),
    errorHash: z.string(),
  }).optional(),
  operations: z.object({
    dbQueries: z.number(),
    externalCalls: z.number(),
    redisOps: z.number(),
  }),
  operationDetails: z.object({
    dbQueries: z.array(z.any()),
    externalCalls: z.array(z.any()),
    redisOps: z.array(z.any()),
  }),
  environment: z.string(),
  userId: z.string().optional(),
  gitCommitSha: z.string().optional(),
  correlationId: z.string(),
})

const BatchSchema = z.object({
  events: z.array(EventSchema).max(100),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Extract and validate API key
    const apiKey = req.headers.get('x-replayly-api-key')
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      )
    }
    
    const apiKeyData = await validateApiKey(apiKey)
    if (!apiKeyData) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }
    
    // 2. Rate limiting
    const rateLimitResult = await rateLimiter.check(apiKeyData.projectId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter.toString(),
          },
        }
      )
    }
    
    // 3. Parse and validate request body
    const body = await req.json()
    const validation = BatchSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }
    
    const { events } = validation.data
    
    // 4. Enqueue events for processing
    const jobIds: string[] = []
    
    for (const event of events) {
      // Attach project and organization IDs
      const enrichedEvent = {
        ...event,
        projectId: apiKeyData.projectId,
        organizationId: apiKeyData.organizationId,
      }
      
      // Add to queue
      const job = await eventQueue.add('process-event', enrichedEvent, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      })
      
      jobIds.push(job.id!)
    }
    
    // 5. Update API key last used timestamp
    await updateApiKeyLastUsed(apiKeyData.id)
    
    // 6. Return success
    return NextResponse.json({
      success: true,
      received: events.length,
      jobIds,
    })
    
  } catch (error: any) {
    console.error('[Ingestion] Error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function updateApiKeyLastUsed(apiKeyId: string) {
  // Update in background, don't block response
  prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { lastUsedAt: new Date() },
  }).catch(err => {
    console.error('[Ingestion] Failed to update API key:', err)
  })
}
```

---

## API Key Validation

**lib/auth/api-key.ts:**

```typescript
import { prisma } from '@/lib/db/postgres'
import crypto from 'crypto'

interface ApiKeyData {
  id: string
  projectId: string
  organizationId: string
  name: string
}

// In-memory cache for API keys (with TTL)
const apiKeyCache = new Map<string, { data: ApiKeyData, expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function validateApiKey(apiKey: string): Promise<ApiKeyData | null> {
  // Check cache first
  const cached = apiKeyCache.get(apiKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }
  
  // Hash the API key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  
  // Look up in database
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      project: {
        select: {
          id: true,
          organizationId: true,
        },
      },
    },
  })
  
  if (!apiKeyRecord) {
    return null
  }
  
  // Check expiration
  if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
    return null
  }
  
  const data: ApiKeyData = {
    id: apiKeyRecord.id,
    projectId: apiKeyRecord.projectId,
    organizationId: apiKeyRecord.project.organizationId,
    name: apiKeyRecord.name,
  }
  
  // Cache the result
  apiKeyCache.set(apiKey, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  })
  
  return data
}
```

---

## Rate Limiting

**lib/rate-limit.ts:**

```typescript
import { redis } from '@/lib/db/redis'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter: number
}

class RateLimiter {
  private defaultLimit = 1000 // requests per minute
  private windowMs = 60 * 1000 // 1 minute
  
  async check(projectId: string): Promise<RateLimitResult> {
    const key = `rate_limit:${projectId}`
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart)
    
    // Count requests in current window
    const count = await redis.zcard(key)
    
    if (count >= this.defaultLimit) {
      // Get oldest entry to calculate retry time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES')
      const oldestTimestamp = oldest[1] ? parseInt(oldest[1]) : now
      const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000)
      
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      }
    }
    
    // Add current request
    await redis.zadd(key, now, `${now}:${Math.random()}`)
    await redis.expire(key, Math.ceil(this.windowMs / 1000))
    
    return {
      allowed: true,
      remaining: this.defaultLimit - count - 1,
      retryAfter: 0,
    }
  }
}

export const rateLimiter = new RateLimiter()
```

---

## BullMQ Queue Setup

**lib/queue/event-queue.ts:**

```typescript
import { Queue, Worker, Job } from 'bullmq'
import { redis } from '@/lib/db/redis'
import IORedis from 'ioredis'

// Create Redis connection for BullMQ
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
})

// Create event queue
export const eventQueue = new Queue('events', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600, // 7 days
    },
  },
})

// Queue events
eventQueue.on('error', (error) => {
  console.error('[Queue] Error:', error)
})

eventQueue.on('waiting', (jobId) => {
  console.log(`[Queue] Job ${jobId} is waiting`)
})

// Export queue for adding jobs
export { connection }
```

---

## Event Processor Worker

**workers/event-processor/index.ts:**

```typescript
import { Worker, Job } from 'bullmq'
import { connection } from '@/lib/queue/event-queue'
import { storeEventMetadata } from './storage/mongodb'
import { storeEventPayload } from './storage/minio'
import { storeEventAnalytics } from './storage/postgres'
import { indexEventSearch } from './storage/opensearch'
import { compressPayload } from './utils/compression'

interface EventJob {
  organizationId: string
  projectId: string
  requestId: string
  timestamp: string
  durationMs: number
  method: string
  url: string
  statusCode: number
  isError: boolean
  error?: {
    message: string
    errorHash: string
    stack?: string
  }
  operations: {
    dbQueries: number
    externalCalls: number
    redisOps: number
  }
  operationDetails: any
  environment: string
  userId?: string
  gitCommitSha?: string
  correlationId: string
  [key: string]: any
}

// Create worker
const worker = new Worker<EventJob>(
  'events',
  async (job: Job<EventJob>) => {
    const event = job.data
    
    console.log(`[Worker] Processing event ${event.requestId}`)
    
    try {
      // 1. Compress full payload
      const compressedPayload = await compressPayload(event)
      
      // 2. Store raw payload in MinIO
      const s3Pointer = await storeEventPayload(
        event.organizationId,
        event.projectId,
        event.requestId,
        compressedPayload
      )
      
      // 3. Store metadata in MongoDB
      await storeEventMetadata({
        organizationId: event.organizationId,
        projectId: event.projectId,
        requestId: event.requestId,
        method: event.method,
        route: extractRoute(event.url),
        url: event.url,
        statusCode: event.statusCode,
        timestamp: new Date(event.timestamp),
        durationMs: event.durationMs,
        isError: event.isError,
        errorHash: event.error?.errorHash,
        errorMessage: event.error?.message,
        environment: event.environment,
        userId: event.userId,
        gitCommitSha: event.gitCommitSha,
        correlationId: event.correlationId,
        s3Pointer,
        operations: event.operations,
      })
      
      // 4. Store analytics in PostgreSQL
      await storeEventAnalytics({
        projectId: event.projectId,
        timestamp: new Date(event.timestamp),
        durationMs: event.durationMs,
        isError: event.isError,
      })
      
      // 5. Index in OpenSearch for full-text search
      await indexEventSearch({
        organizationId: event.organizationId,
        projectId: event.projectId,
        requestId: event.requestId,
        method: event.method,
        url: event.url,
        route: extractRoute(event.url),
        statusCode: event.statusCode,
        timestamp: event.timestamp,
        errorMessage: event.error?.message,
        errorHash: event.error?.errorHash,
        environment: event.environment,
        s3Pointer,
      })
      
      console.log(`[Worker] Successfully processed event ${event.requestId}`)
      
      return { success: true }
      
    } catch (error: any) {
      console.error(`[Worker] Error processing event ${event.requestId}:`, error)
      throw error // Will trigger retry
    }
  },
  {
    connection,
    concurrency: 10, // Process 10 events concurrently
    limiter: {
      max: 100, // Max 100 jobs
      duration: 1000, // per second
    },
  }
)

// Worker events
worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message)
})

worker.on('error', (err) => {
  console.error('[Worker] Error:', err)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...')
  await worker.close()
  process.exit(0)
})

// Helper function to extract route pattern
function extractRoute(url: string): string {
  try {
    const urlObj = new URL(url)
    let path = urlObj.pathname
    
    // Replace UUIDs with :id
    path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    
    // Replace numeric IDs with :id
    path = path.replace(/\/\d+/g, '/:id')
    
    return path
  } catch {
    return url
  }
}

console.log('[Worker] Event processor started')
```

---

## Storage Implementations

### MongoDB Storage

**workers/event-processor/storage/mongodb.ts:**

```typescript
import { mongodb } from '@/lib/db/mongodb'

interface EventMetadata {
  organizationId: string
  projectId: string
  requestId: string
  method: string
  route: string
  url: string
  statusCode: number
  timestamp: Date
  durationMs: number
  isError: boolean
  errorHash?: string
  errorMessage?: string
  environment: string
  userId?: string
  gitCommitSha?: string
  correlationId: string
  s3Pointer: string
  operations: {
    dbQueries: number
    externalCalls: number
    redisOps: number
  }
}

export async function storeEventMetadata(event: EventMetadata) {
  const db = await mongodb.getDb()
  const collection = db.collection('events')
  
  await collection.insertOne({
    ...event,
    createdAt: new Date(),
  })
}
```

### MinIO Storage

**workers/event-processor/storage/minio.ts:**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // Required for MinIO
})

const BUCKET = process.env.S3_BUCKET || 'replayly-events'

export async function storeEventPayload(
  organizationId: string,
  projectId: string,
  requestId: string,
  payload: Buffer
): Promise<string> {
  const key = `${organizationId}/${projectId}/${requestId}.json.gz`
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: payload,
      ContentType: 'application/json',
      ContentEncoding: 'gzip',
    })
  )
  
  return key
}
```

### PostgreSQL Analytics

**workers/event-processor/storage/postgres.ts:**

```typescript
import { prisma } from '@/lib/db/postgres'

interface EventAnalytics {
  projectId: string
  timestamp: Date
  durationMs: number
  isError: boolean
}

export async function storeEventAnalytics(event: EventAnalytics) {
  const date = new Date(event.timestamp)
  date.setHours(0, 0, 0, 0) // Normalize to day
  
  // Upsert daily stats
  await prisma.dailyStats.upsert({
    where: {
      projectId_date: {
        projectId: event.projectId,
        date,
      },
    },
    create: {
      projectId: event.projectId,
      date,
      totalEvents: 1,
      errorEvents: event.isError ? 1 : 0,
      avgDurationMs: event.durationMs,
      p95DurationMs: event.durationMs,
      p99DurationMs: event.durationMs,
    },
    update: {
      totalEvents: { increment: 1 },
      errorEvents: { increment: event.isError ? 1 : 0 },
      // Note: Proper percentile calculation would be done in a separate aggregation job
    },
  })
}
```

### OpenSearch Indexing

**workers/event-processor/storage/opensearch.ts:**

```typescript
import { Client } from '@opensearch-project/opensearch'

const client = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
})

interface SearchDocument {
  organizationId: string
  projectId: string
  requestId: string
  method: string
  url: string
  route: string
  statusCode: number
  timestamp: string
  errorMessage?: string
  errorHash?: string
  environment: string
  s3Pointer: string
}

export async function indexEventSearch(doc: SearchDocument) {
  const index = `events-${doc.projectId}`
  
  // Ensure index exists
  await ensureIndexExists(index)
  
  // Index document
  await client.index({
    index,
    id: doc.requestId,
    body: doc,
  })
}

async function ensureIndexExists(index: string) {
  const exists = await client.indices.exists({ index })
  
  if (!exists.body) {
    await client.indices.create({
      index,
      body: {
        mappings: {
          properties: {
            organizationId: { type: 'keyword' },
            projectId: { type: 'keyword' },
            requestId: { type: 'keyword' },
            method: { type: 'keyword' },
            url: { type: 'text' },
            route: { type: 'keyword' },
            statusCode: { type: 'integer' },
            timestamp: { type: 'date' },
            errorMessage: { type: 'text' },
            errorHash: { type: 'keyword' },
            environment: { type: 'keyword' },
            s3Pointer: { type: 'keyword' },
          },
        },
      },
    })
  }
}
```

---

## Compression Utility

**workers/event-processor/utils/compression.ts:**

```typescript
import { gzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)

export async function compressPayload(data: any): Promise<Buffer> {
  const json = JSON.stringify(data)
  return gzipAsync(Buffer.from(json, 'utf-8'))
}
```

---

## Database Connection Utilities

### MongoDB Connection

**lib/db/mongodb.ts:**

```typescript
import { MongoClient, Db } from 'mongodb'

class MongoDB {
  private client: MongoClient | null = null
  private db: Db | null = null
  
  async connect() {
    if (this.client) return
    
    this.client = new MongoClient(process.env.MONGODB_URI!)
    await this.client.connect()
    this.db = this.client.db()
    
    console.log('[MongoDB] Connected')
  }
  
  async getDb(): Promise<Db> {
    if (!this.db) {
      await this.connect()
    }
    return this.db!
  }
  
  async close() {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.db = null
    }
  }
}

export const mongodb = new MongoDB()
```

### Redis Connection

**lib/db/redis.ts:**

```typescript
import Redis from 'ioredis'

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
})

redis.on('connect', () => {
  console.log('[Redis] Connected')
})

redis.on('error', (err) => {
  console.error('[Redis] Error:', err)
})
```

---

## Worker Deployment

### Docker Configuration

**docker-compose.yml (add worker service):**

```yaml
services:
  # ... existing services ...
  
  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    container_name: replayly-worker
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://replayly:replayly_dev_password@postgres:5432/replayly
      MONGODB_URI: mongodb://replayly:replayly_dev_password@mongodb:27017/replayly
      REDIS_HOST: redis
      REDIS_PORT: 6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: replayly
      S3_SECRET_KEY: replayly_dev_password
      S3_BUCKET: replayly-events
      OPENSEARCH_URL: http://opensearch:9200
    depends_on:
      - postgres
      - mongodb
      - redis
      - minio
      - opensearch
    restart: unless-stopped
```

**Dockerfile.worker:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "workers/event-processor/index.js"]
```

---

## Monitoring & Observability

### Queue Metrics

```typescript
// lib/queue/metrics.ts
import { eventQueue } from './event-queue'

export async function getQueueMetrics() {
  const [waiting, active, completed, failed] = await Promise.all([
    eventQueue.getWaitingCount(),
    eventQueue.getActiveCount(),
    eventQueue.getCompletedCount(),
    eventQueue.getFailedCount(),
  ])
  
  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active,
  }
}
```

### Health Check Endpoint

**app/api/health/route.ts:**

```typescript
import { NextResponse } from 'next/server'
import { mongodb } from '@/lib/db/mongodb'
import { redis } from '@/lib/db/redis'
import { prisma } from '@/lib/db/postgres'
import { getQueueMetrics } from '@/lib/queue/metrics'

export async function GET() {
  const checks = {
    postgres: false,
    mongodb: false,
    redis: false,
    queue: null as any,
  }
  
  try {
    // Check PostgreSQL
    await prisma.$queryRaw`SELECT 1`
    checks.postgres = true
  } catch (error) {
    console.error('[Health] PostgreSQL check failed:', error)
  }
  
  try {
    // Check MongoDB
    const db = await mongodb.getDb()
    await db.admin().ping()
    checks.mongodb = true
  } catch (error) {
    console.error('[Health] MongoDB check failed:', error)
  }
  
  try {
    // Check Redis
    await redis.ping()
    checks.redis = true
  } catch (error) {
    console.error('[Health] Redis check failed:', error)
  }
  
  try {
    // Check Queue
    checks.queue = await getQueueMetrics()
  } catch (error) {
    console.error('[Health] Queue check failed:', error)
  }
  
  const healthy = checks.postgres && checks.mongodb && checks.redis
  
  return NextResponse.json(
    { healthy, checks },
    { status: healthy ? 200 : 503 }
  )
}
```

---

## Testing Strategy

### Unit Tests

- API key validation logic
- Rate limiting algorithm
- Payload compression
- Route extraction
- Error hash generation

### Integration Tests

- Ingestion API accepts valid events
- Invalid API keys are rejected
- Rate limiting works correctly
- Events are queued successfully
- Worker processes events end-to-end
- Data is stored in all data stores
- Multi-tenant isolation is enforced

### Load Tests

- Ingestion API handles 1000 req/s
- Queue doesn't overflow under load
- Worker keeps up with event rate
- Rate limiting works under pressure

---

## Acceptance Criteria

### Ingestion API

- [ ] Accepts events from SDK
- [ ] Validates API keys correctly
- [ ] Rejects invalid API keys
- [ ] Enforces rate limits per project
- [ ] Validates event schema
- [ ] Returns appropriate error messages
- [ ] Responds within 50ms (p95)

### Queue System

- [ ] Events are enqueued successfully
- [ ] Failed jobs are retried with backoff
- [ ] Dead letter queue captures permanent failures
- [ ] Queue metrics are accessible
- [ ] No events are lost

### Event Processor

- [ ] Processes events successfully
- [ ] Stores data in all 4 data stores
- [ ] Handles failures gracefully
- [ ] Retries transient errors
- [ ] Compresses payloads efficiently
- [ ] Processes 100+ events/second

### Data Storage

- [ ] MongoDB stores event metadata
- [ ] MinIO stores raw payloads
- [ ] PostgreSQL stores analytics
- [ ] OpenSearch indexes searchable data
- [ ] Multi-tenant isolation is enforced
- [ ] Data is retrievable

### Monitoring

- [ ] Health check endpoint works
- [ ] Queue metrics are accurate
- [ ] Errors are logged properly
- [ ] Worker status is visible

---

## Performance Targets

- Ingestion latency: < 50ms (p95)
- Queue throughput: 1000+ events/second
- Worker processing: 100+ events/second per worker
- Storage latency: < 500ms per event
- No data loss under normal conditions

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Queue overflow | High | Backpressure, rate limiting, auto-scaling |
| Worker crashes | Medium | Automatic restarts, job retries |
| Storage failures | High | Retry logic, dead letter queue |
| Multi-tenant data leakage | Critical | Strict validation, integration tests |
| Performance degradation | Medium | Monitoring, load testing, optimization |

---

## Next Steps

After Phase 3 completion:
- **Phase 4**: Dashboard & Event Viewer
- Build web UI to view captured events
- Implement search and filtering
- Create event detail viewer
- Add performance metrics visualization
