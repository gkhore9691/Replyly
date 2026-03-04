# Phase 2: SDK Development & Instrumentation

## Overview

Build the core Replayly SDK that captures production request lifecycles, including HTTP requests/responses, database queries, external API calls, and Redis operations. The SDK must be lightweight, framework-agnostic, and introduce minimal performance overhead.

**Duration Estimate**: Core product differentiator  
**Priority**: Critical - Required for Phase 3  
**Dependencies**: Phase 1 (authentication system for API keys)

---

## Goals

1. Create `@replayly/sdk` npm package with TypeScript
2. Implement AsyncLocalStorage for request context tracking
3. Build instrumentation for:
   - HTTP requests/responses (Express, Fastify, Next.js)
   - Axios and fetch calls
   - MongoDB (mongoose + native driver)
   - PostgreSQL (pg, Prisma)
   - Redis (ioredis)
4. Implement PII masking engine
5. Build async payload transport with retry logic
6. Ensure SDK overhead < 100ms
7. Create comprehensive SDK documentation

---

## Technical Architecture

### Package Structure

```
packages/sdk/
├── src/
│   ├── core/
│   │   ├── client.ts              # Main SDK client
│   │   ├── context.ts             # AsyncLocalStorage context
│   │   ├── transport.ts           # Async payload sender
│   │   ├── config.ts              # Configuration management
│   │   └── types.ts               # TypeScript types
│   ├── instrumentation/
│   │   ├── http/
│   │   │   ├── express.ts         # Express middleware
│   │   │   ├── fastify.ts         # Fastify plugin
│   │   │   └── nextjs.ts          # Next.js instrumentation
│   │   ├── database/
│   │   │   ├── mongodb.ts         # MongoDB instrumentation
│   │   │   ├── mongoose.ts        # Mongoose instrumentation
│   │   │   ├── postgres.ts        # pg instrumentation
│   │   │   └── prisma.ts          # Prisma instrumentation
│   │   ├── external/
│   │   │   ├── axios.ts           # Axios interceptors
│   │   │   ├── fetch.ts           # fetch wrapper
│   │   │   └── https.ts           # https.request wrapper
│   │   └── cache/
│   │       └── redis.ts           # Redis instrumentation
│   ├── masking/
│   │   ├── pii-detector.ts        # PII field detection
│   │   ├── masker.ts              # Data masking logic
│   │   └── patterns.ts            # Regex patterns
│   ├── utils/
│   │   ├── serializer.ts          # Safe JSON serialization
│   │   ├── error-parser.ts        # Stack trace parsing
│   │   └── hash.ts                # Error hashing
│   └── index.ts                   # Public API
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── examples/
│   ├── express-app/
│   ├── nextjs-app/
│   └── fastify-app/
├── package.json
├── tsconfig.json
└── README.md
```

---

## Core SDK Implementation

### 1. SDK Client

**packages/sdk/src/core/client.ts:**

```typescript
import { AsyncLocalStorage } from 'async_hooks'
import { ReplaylyConfig, RequestContext, CapturedEvent } from './types'
import { Transport } from './transport'
import { Masker } from '../masking/masker'

export class ReplaylyClient {
  private config: ReplaylyConfig
  private transport: Transport
  private masker: Masker
  private asyncLocalStorage: AsyncLocalStorage<RequestContext>
  
  constructor(config: ReplaylyConfig) {
    this.config = this.validateConfig(config)
    this.transport = new Transport(config)
    this.masker = new Masker(config.maskFields || [])
    this.asyncLocalStorage = new AsyncLocalStorage()
    
    // Initialize instrumentation
    this.initializeInstrumentation()
  }
  
  private validateConfig(config: ReplaylyConfig): ReplaylyConfig {
    if (!config.apiKey) {
      throw new Error('Replayly: apiKey is required')
    }
    
    return {
      ...config,
      endpoint: config.endpoint || 'https://api.replayly.dev/ingest',
      environment: config.environment || process.env.NODE_ENV || 'production',
      maxPayloadSize: config.maxPayloadSize || 200 * 1024, // 200KB
      sampleRate: config.sampleRate || 1.0,
      captureBody: config.captureBody !== false,
      captureHeaders: config.captureHeaders !== false,
    }
  }
  
  private initializeInstrumentation() {
    // Auto-instrument based on config
    if (this.config.captureAxios !== false) {
      require('../instrumentation/external/axios').instrument(this)
    }
    
    if (this.config.captureFetch !== false) {
      require('../instrumentation/external/fetch').instrument(this)
    }
    
    if (this.config.captureMongo !== false) {
      require('../instrumentation/database/mongodb').instrument(this)
    }
    
    if (this.config.capturePostgres !== false) {
      require('../instrumentation/database/postgres').instrument(this)
    }
    
    if (this.config.captureRedis !== false) {
      require('../instrumentation/cache/redis').instrument(this)
    }
  }
  
  // Create request context
  public createContext(req: any): RequestContext {
    return {
      requestId: this.generateRequestId(),
      startTime: Date.now(),
      method: req.method,
      url: req.url,
      headers: this.masker.maskHeaders(req.headers),
      query: req.query,
      body: this.captureRequestBody(req),
      operations: {
        dbQueries: [],
        externalCalls: [],
        redisOps: [],
      },
      metadata: {
        userId: req.user?.id,
        gitCommitSha: process.env.GIT_COMMIT_SHA,
        environment: this.config.environment,
      },
    }
  }
  
  // Run code within request context
  public runInContext<T>(context: RequestContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn)
  }
  
  // Get current context
  public getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore()
  }
  
  // Capture operation (DB query, API call, etc.)
  public captureOperation(type: string, data: any) {
    const context = this.getContext()
    if (!context) return
    
    const operation = {
      type,
      timestamp: Date.now(),
      durationMs: 0,
      ...data,
    }
    
    switch (type) {
      case 'db_query':
        context.operations.dbQueries.push(operation)
        break
      case 'external_call':
        context.operations.externalCalls.push(operation)
        break
      case 'redis_op':
        context.operations.redisOps.push(operation)
        break
    }
  }
  
  // Finalize and send event
  public async captureResponse(res: any, error?: Error) {
    const context = this.getContext()
    if (!context) return
    
    // Check sampling
    if (Math.random() > this.config.sampleRate) {
      return
    }
    
    const event: CapturedEvent = {
      projectId: this.config.projectId,
      requestId: context.requestId,
      timestamp: new Date(context.startTime).toISOString(),
      durationMs: Date.now() - context.startTime,
      
      // Request
      method: context.method,
      url: context.url,
      headers: context.headers,
      query: context.query,
      body: context.body,
      
      // Response
      statusCode: res.statusCode,
      responseBody: this.captureResponseBody(res),
      
      // Error
      isError: !!error || res.statusCode >= 400,
      error: error ? this.captureError(error) : undefined,
      
      // Operations
      operations: {
        dbQueries: context.operations.dbQueries.length,
        externalCalls: context.operations.externalCalls.length,
        redisOps: context.operations.redisOps.length,
      },
      operationDetails: context.operations,
      
      // Metadata
      environment: context.metadata.environment,
      userId: context.metadata.userId,
      gitCommitSha: context.metadata.gitCommitSha,
      correlationId: context.requestId,
    }
    
    // Mask sensitive data
    const maskedEvent = this.masker.maskEvent(event)
    
    // Send async (non-blocking)
    this.transport.send(maskedEvent).catch(err => {
      console.error('[Replayly] Failed to send event:', err.message)
    })
  }
  
  private captureError(error: Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      errorHash: this.generateErrorHash(error),
    }
  }
  
  private generateErrorHash(error: Error): string {
    const crypto = require('crypto')
    const normalized = this.normalizeStackTrace(error.stack || '')
    return crypto.createHash('sha256').update(normalized).digest('hex')
  }
  
  private normalizeStackTrace(stack: string): string {
    // Remove line numbers and file paths to group similar errors
    return stack
      .split('\n')
      .map(line => line.replace(/:\d+:\d+/g, ''))
      .join('\n')
  }
  
  private captureRequestBody(req: any): any {
    if (!this.config.captureBody) return undefined
    
    const body = req.body
    if (!body) return undefined
    
    const size = JSON.stringify(body).length
    if (size > this.config.maxPayloadSize!) {
      return { _truncated: true, _size: size }
    }
    
    return body
  }
  
  private captureResponseBody(res: any): any {
    if (!this.config.captureBody) return undefined
    
    // Response body capture is tricky - need to intercept res.send/json
    return res._replaylyBody
  }
  
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
```

---

### 2. AsyncLocalStorage Context

**packages/sdk/src/core/context.ts:**

```typescript
export interface RequestContext {
  requestId: string
  startTime: number
  method: string
  url: string
  headers: Record<string, string>
  query: any
  body: any
  operations: {
    dbQueries: Array<any>
    externalCalls: Array<any>
    redisOps: Array<any>
  }
  metadata: {
    userId?: string
    gitCommitSha?: string
    environment: string
  }
}

export interface CapturedEvent {
  projectId: string
  requestId: string
  timestamp: string
  durationMs: number
  
  // Request
  method: string
  url: string
  headers: Record<string, string>
  query: any
  body: any
  
  // Response
  statusCode: number
  responseBody: any
  
  // Error
  isError: boolean
  error?: {
    message: string
    name: string
    stack?: string
    errorHash: string
  }
  
  // Operations
  operations: {
    dbQueries: number
    externalCalls: number
    redisOps: number
  }
  operationDetails: {
    dbQueries: Array<any>
    externalCalls: Array<any>
    redisOps: Array<any>
  }
  
  // Metadata
  environment: string
  userId?: string
  gitCommitSha?: string
  correlationId: string
}
```

---

### 3. Async Transport

**packages/sdk/src/core/transport.ts:**

```typescript
import axios from 'axios'
import { CapturedEvent, ReplaylyConfig } from './types'

export class Transport {
  private config: ReplaylyConfig
  private queue: CapturedEvent[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private maxQueueSize = 100
  private flushIntervalMs = 5000
  
  constructor(config: ReplaylyConfig) {
    this.config = config
    this.startFlushInterval()
  }
  
  async send(event: CapturedEvent): Promise<void> {
    this.queue.push(event)
    
    if (this.queue.length >= this.maxQueueSize) {
      await this.flush()
    }
  }
  
  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush().catch(err => {
          console.error('[Replayly] Flush error:', err.message)
        })
      }
    }, this.flushIntervalMs)
  }
  
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return
    
    const events = this.queue.splice(0, this.maxQueueSize)
    
    try {
      await axios.post(
        this.config.endpoint!,
        { events },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Replayly-API-Key': this.config.apiKey,
          },
          timeout: 5000,
        }
      )
    } catch (error: any) {
      console.error('[Replayly] Failed to send events:', error.message)
      
      // Re-queue events if transient error
      if (this.isRetryable(error)) {
        this.queue.unshift(...events)
      }
    }
  }
  
  private isRetryable(error: any): boolean {
    // Retry on network errors or 5xx responses
    return !error.response || error.response.status >= 500
  }
  
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    await this.flush()
  }
}
```

---

## Instrumentation

### Express Middleware

**packages/sdk/src/instrumentation/http/express.ts:**

```typescript
import { Request, Response, NextFunction } from 'express'
import { ReplaylyClient } from '../../core/client'

export function createExpressMiddleware(client: ReplaylyClient) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = client.createContext(req)
    
    // Intercept response
    const originalSend = res.send
    const originalJson = res.json
    
    res.send = function (body: any) {
      res._replaylyBody = body
      return originalSend.call(this, body)
    }
    
    res.json = function (body: any) {
      res._replaylyBody = body
      return originalJson.call(this, body)
    }
    
    // Capture response on finish
    res.on('finish', () => {
      client.captureResponse(res).catch(err => {
        console.error('[Replayly] Error capturing response:', err)
      })
    })
    
    // Run request handler in context
    client.runInContext(context, () => {
      next()
    })
  }
}

// Usage:
// app.use(createExpressMiddleware(replaylyClient))
```

---

### MongoDB Instrumentation

**packages/sdk/src/instrumentation/database/mongodb.ts:**

```typescript
import { ReplaylyClient } from '../../core/client'

export function instrument(client: ReplaylyClient) {
  try {
    const mongodb = require('mongodb')
    
    // Instrument MongoClient
    const originalConnect = mongodb.MongoClient.prototype.connect
    mongodb.MongoClient.prototype.connect = async function (...args: any[]) {
      const mongoClient = await originalConnect.apply(this, args)
      
      // Add command monitoring
      mongoClient.on('commandStarted', (event: any) => {
        const context = client.getContext()
        if (!context) return
        
        context._mongoCommands = context._mongoCommands || {}
        context._mongoCommands[event.requestId] = {
          command: event.commandName,
          collection: event.command[event.commandName],
          startTime: Date.now(),
        }
      })
      
      mongoClient.on('commandSucceeded', (event: any) => {
        const context = client.getContext()
        if (!context || !context._mongoCommands) return
        
        const commandData = context._mongoCommands[event.requestId]
        if (!commandData) return
        
        client.captureOperation('db_query', {
          database: 'mongodb',
          command: commandData.command,
          collection: commandData.collection,
          durationMs: Date.now() - commandData.startTime,
          success: true,
        })
        
        delete context._mongoCommands[event.requestId]
      })
      
      mongoClient.on('commandFailed', (event: any) => {
        const context = client.getContext()
        if (!context || !context._mongoCommands) return
        
        const commandData = context._mongoCommands[event.requestId]
        if (!commandData) return
        
        client.captureOperation('db_query', {
          database: 'mongodb',
          command: commandData.command,
          collection: commandData.collection,
          durationMs: Date.now() - commandData.startTime,
          success: false,
          error: event.failure.message,
        })
        
        delete context._mongoCommands[event.requestId]
      })
      
      return mongoClient
    }
  } catch (error) {
    // MongoDB not installed, skip instrumentation
  }
}
```

---

### Axios Instrumentation

**packages/sdk/src/instrumentation/external/axios.ts:**

```typescript
import { ReplaylyClient } from '../../core/client'

export function instrument(client: ReplaylyClient) {
  try {
    const axios = require('axios')
    
    // Request interceptor
    axios.interceptors.request.use((config: any) => {
      config._replaylyStartTime = Date.now()
      return config
    })
    
    // Response interceptor
    axios.interceptors.response.use(
      (response: any) => {
        captureAxiosCall(client, response.config, response, null)
        return response
      },
      (error: any) => {
        captureAxiosCall(client, error.config, error.response, error)
        return Promise.reject(error)
      }
    )
  } catch (error) {
    // Axios not installed, skip instrumentation
  }
}

function captureAxiosCall(
  client: ReplaylyClient,
  config: any,
  response: any,
  error: any
) {
  const durationMs = Date.now() - (config._replaylyStartTime || Date.now())
  
  client.captureOperation('external_call', {
    method: config.method?.toUpperCase(),
    url: config.url,
    statusCode: response?.status,
    durationMs,
    success: !error,
    error: error?.message,
  })
}
```

---

### PostgreSQL Instrumentation

**packages/sdk/src/instrumentation/database/postgres.ts:**

```typescript
import { ReplaylyClient } from '../../core/client'

export function instrument(client: ReplaylyClient) {
  try {
    const pg = require('pg')
    
    // Wrap pg.Client.query
    const originalQuery = pg.Client.prototype.query
    pg.Client.prototype.query = function (...args: any[]) {
      const startTime = Date.now()
      const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text
      
      const promise = originalQuery.apply(this, args)
      
      promise
        .then((result: any) => {
          client.captureOperation('db_query', {
            database: 'postgresql',
            query: queryText,
            durationMs: Date.now() - startTime,
            rowCount: result.rowCount,
            success: true,
          })
        })
        .catch((error: any) => {
          client.captureOperation('db_query', {
            database: 'postgresql',
            query: queryText,
            durationMs: Date.now() - startTime,
            success: false,
            error: error.message,
          })
        })
      
      return promise
    }
  } catch (error) {
    // pg not installed, skip instrumentation
  }
}
```

---

### Redis Instrumentation

**packages/sdk/src/instrumentation/cache/redis.ts:**

```typescript
import { ReplaylyClient } from '../../core/client'

export function instrument(client: ReplaylyClient) {
  try {
    const Redis = require('ioredis')
    
    // Wrap Redis command execution
    const originalSendCommand = Redis.prototype.sendCommand
    Redis.prototype.sendCommand = function (command: any, ...args: any[]) {
      const startTime = Date.now()
      const commandName = command.name
      
      const promise = originalSendCommand.call(this, command, ...args)
      
      promise
        .then(() => {
          client.captureOperation('redis_op', {
            command: commandName,
            durationMs: Date.now() - startTime,
            success: true,
          })
        })
        .catch((error: any) => {
          client.captureOperation('redis_op', {
            command: commandName,
            durationMs: Date.now() - startTime,
            success: false,
            error: error.message,
          })
        })
      
      return promise
    }
  } catch (error) {
    // ioredis not installed, skip instrumentation
  }
}
```

---

## PII Masking

**packages/sdk/src/masking/masker.ts:**

```typescript
import { PII_PATTERNS } from './patterns'

export class Masker {
  private maskFields: string[]
  
  constructor(maskFields: string[] = []) {
    this.maskFields = [
      ...maskFields,
      'password',
      'token',
      'apiKey',
      'secret',
      'creditCard',
      'ssn',
    ]
  }
  
  maskEvent(event: any): any {
    return this.maskObject(event)
  }
  
  maskHeaders(headers: Record<string, any>): Record<string, any> {
    const masked = { ...headers }
    
    // Mask authorization headers
    if (masked.authorization) {
      masked.authorization = this.maskValue(masked.authorization)
    }
    if (masked.cookie) {
      masked.cookie = '[MASKED]'
    }
    
    return masked
  }
  
  private maskObject(obj: any): any {
    if (obj === null || obj === undefined) return obj
    if (typeof obj !== 'object') return obj
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item))
    }
    
    const masked: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (this.shouldMaskField(key)) {
        masked[key] = this.maskValue(value)
      } else {
        masked[key] = this.maskObject(value)
      }
    }
    
    return masked
  }
  
  private shouldMaskField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase()
    return this.maskFields.some(mask => lowerField.includes(mask.toLowerCase()))
  }
  
  private maskValue(value: any): string {
    if (typeof value === 'string' && value.length > 0) {
      return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
    }
    return '[MASKED]'
  }
}
```

---

## SDK Configuration

**packages/sdk/src/core/types.ts:**

```typescript
export interface ReplaylyConfig {
  // Required
  apiKey: string
  projectId?: string // Extracted from API key if not provided
  
  // Optional
  endpoint?: string
  environment?: string
  
  // Capture settings
  captureBody?: boolean
  captureHeaders?: boolean
  maxPayloadSize?: number
  sampleRate?: number
  
  // Instrumentation toggles
  captureAxios?: boolean
  captureFetch?: boolean
  captureMongo?: boolean
  capturePostgres?: boolean
  captureRedis?: boolean
  
  // PII masking
  maskFields?: string[]
  
  // Performance
  flushInterval?: number
  maxQueueSize?: number
}
```

---

## Usage Examples

### Express Application

```typescript
import express from 'express'
import { ReplaylyClient, createExpressMiddleware } from '@replayly/sdk'

const app = express()

// Initialize Replayly
const replayly = new ReplaylyClient({
  apiKey: process.env.REPLAYLY_API_KEY!,
  environment: 'production',
  maskFields: ['password', 'creditCard'],
})

// Add middleware (must be early in chain)
app.use(createExpressMiddleware(replayly))

// Your routes
app.get('/api/users', async (req, res) => {
  // All DB queries, API calls automatically captured
  const users = await User.find()
  res.json(users)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await replayly.shutdown()
  process.exit(0)
})
```

---

## Testing Strategy

### Unit Tests

- AsyncLocalStorage context propagation
- PII masking logic
- Error hash generation
- Payload size limits
- Sampling logic

### Integration Tests

- Express middleware captures request/response
- MongoDB queries are tracked
- Axios calls are intercepted
- Redis operations are logged
- Context is maintained across async operations

### Performance Tests

- SDK overhead < 100ms
- Memory usage is bounded
- No memory leaks with long-running processes
- Queue flush performance

---

## Acceptance Criteria

### Core Functionality

- [ ] SDK initializes without errors
- [ ] AsyncLocalStorage maintains context across async operations
- [ ] Request/response data is captured accurately
- [ ] Errors and stack traces are captured
- [ ] Events are sent asynchronously (non-blocking)

### Instrumentation

- [ ] Express middleware works correctly
- [ ] MongoDB queries are captured (native driver + mongoose)
- [ ] PostgreSQL queries are captured (pg)
- [ ] Axios calls are intercepted
- [ ] Redis operations are tracked
- [ ] Context is maintained for all operations

### PII Masking

- [ ] Configured fields are masked
- [ ] Authorization headers are masked
- [ ] Nested objects are masked recursively
- [ ] Arrays are handled correctly

### Performance

- [ ] SDK overhead < 100ms per request
- [ ] No memory leaks over 1000+ requests
- [ ] Queue flushes efficiently
- [ ] Payload size limits are enforced

### Developer Experience

- [ ] TypeScript types are accurate
- [ ] Error messages are helpful
- [ ] Configuration is intuitive
- [ ] Documentation is comprehensive
- [ ] Examples work out of the box

---

## Dependencies

**packages/sdk/package.json:**

```json
{
  "name": "@replayly/sdk",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "axios": "^1.6.8"
  },
  "peerDependencies": {
    "express": "^4.x",
    "mongodb": "^6.x",
    "ioredis": "^5.x",
    "pg": "^8.x"
  },
  "peerDependenciesMeta": {
    "express": { "optional": true },
    "mongodb": { "optional": true },
    "ioredis": { "optional": true },
    "pg": { "optional": true }
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/express": "^4",
    "typescript": "^5",
    "jest": "^29",
    "@types/jest": "^29"
  }
}
```

---

## Documentation

### README.md

- Installation instructions
- Quick start guide
- Configuration options
- Framework-specific guides
- PII masking guide
- Performance considerations
- Troubleshooting

### API Documentation

- ReplaylyClient API
- Middleware functions
- Configuration interface
- TypeScript types

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Monkey patching breaks libraries | High | Extensive testing, graceful fallbacks |
| AsyncLocalStorage performance | Medium | Benchmark, optimize context size |
| Memory leaks in long-running apps | High | Proper cleanup, bounded queues |
| Instrumentation conflicts | Medium | Detect other APM tools, coordinate |
| Payload size explosion | Medium | Hard limits, truncation, sampling |

---

## Next Steps

After Phase 2 completion:
- **Phase 3**: Ingestion API & Event Processing
- Build ingestion endpoint to receive SDK events
- Set up BullMQ queue and worker
- Implement storage pipeline (MongoDB, MinIO, OpenSearch)
