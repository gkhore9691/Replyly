# Phase 10: Advanced SDK Instrumentation

## Overview

Expand SDK coverage to support more frameworks, ORMs, and protocols. This phase makes Replayly compatible with a wider range of tech stacks, increasing market reach and developer adoption.

**Duration Estimate**: 5-6 weeks  
**Priority**: Medium - Expands market reach  
**Dependencies**: Phase 2 (core SDK)

---

## Goals

1. Create framework-specific packages (Fastify, Next.js, NestJS)
2. Add ORM instrumentation (Prisma, Mongoose, TypeORM)
3. Implement protocol instrumentation (GraphQL, WebSocket, gRPC)
4. Build custom instrumentation API for manual tracking
5. Add breadcrumb tracking for user actions
6. Implement user context enrichment
7. Optimize SDK performance with adaptive batching
8. Create comprehensive SDK documentation

---

## Technical Architecture

### Package Structure

```
packages/
├── sdk/              # Core SDK (existing)
├── fastify/          # Fastify plugin
├── nextjs/           # Next.js integration
├── nestjs/           # NestJS module
└── instrumentation/  # Shared instrumentation utilities
```

---

## Part 1: Framework Support

### 1.1 Fastify Plugin

**packages/fastify/package.json:**

```json
{
  "name": "@replayly/fastify",
  "version": "1.0.0",
  "description": "Replayly plugin for Fastify",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "peerDependencies": {
    "fastify": "^4.0.0",
    "@replayly/sdk": "^1.0.0"
  },
  "dependencies": {
    "fastify-plugin": "^4.5.0"
  }
}
```

**packages/fastify/src/index.ts:**

```typescript
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { ReplaylyClient, ReplaylyConfig } from '@replayly/sdk'

export interface ReplaylyFastifyOptions extends ReplaylyConfig {
  // Fastify-specific options
  captureHeaders?: boolean
  captureQuery?: boolean
  captureBody?: boolean
  captureResponse?: boolean
  ignoreRoutes?: string[]
}

const replaylyPlugin: FastifyPluginAsync<ReplaylyFastifyOptions> = async (
  fastify,
  options
) => {
  const client = new ReplaylyClient(options)

  // Initialize instrumentation
  await client.init()

  // Add hooks for request/response capture
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const context = client.createContext({
      method: request.method,
      url: request.url,
      headers: options.captureHeaders !== false ? request.headers : {},
      query: options.captureQuery !== false ? request.query : {},
      body: options.captureBody !== false ? request.body : null,
    })

    // Store context in request
    ;(request as any).replaylyContext = context

    // Run in context
    await client.runInContext(context, async () => {
      // Continue with request
    })
  })

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const context = (request as any).replaylyContext
    if (!context) return

    // Capture response
    context.response = {
      statusCode: reply.statusCode,
      headers: reply.getHeaders(),
      // Body is not easily accessible in Fastify onResponse hook
    }

    context.durationMs = Date.now() - context.startTime

    // Send event
    await client.sendEvent(context)
  })

  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const context = (request as any).replaylyContext
    if (!context) return

    // Capture error
    context.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }

    context.durationMs = Date.now() - context.startTime

    // Send event
    await client.sendEvent(context)
  })

  // Decorate fastify instance with replayly client
  fastify.decorate('replayly', client)

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await client.flush()
  })
}

export default fp(replaylyPlugin, {
  fastify: '4.x',
  name: '@replayly/fastify'
})

// Type augmentation
declare module 'fastify' {
  interface FastifyInstance {
    replayly: ReplaylyClient
  }
}
```

**packages/fastify/README.md:**

```markdown
# @replayly/fastify

Replayly plugin for Fastify applications.

## Installation

```bash
npm install @replayly/fastify @replayly/sdk
```

## Usage

```typescript
import Fastify from 'fastify'
import replayly from '@replayly/fastify'

const fastify = Fastify()

await fastify.register(replayly, {
  apiKey: process.env.REPLAYLY_API_KEY,
  environment: process.env.NODE_ENV,
  maskFields: ['password', 'token'],
  captureHeaders: true,
  captureQuery: true,
  captureBody: true,
  captureResponse: true,
  ignoreRoutes: ['/health', '/metrics']
})

fastify.get('/api/users', async (request, reply) => {
  // Your route handler
  return { users: [] }
})

await fastify.listen({ port: 3000 })
```

## Configuration

- `apiKey` - Your Replayly API key
- `environment` - Environment name (e.g., 'production', 'staging')
- `maskFields` - Array of field names to mask in requests/responses
- `captureHeaders` - Capture request headers (default: true)
- `captureQuery` - Capture query parameters (default: true)
- `captureBody` - Capture request body (default: true)
- `captureResponse` - Capture response body (default: true)
- `ignoreRoutes` - Array of route patterns to ignore

## Accessing the Client

```typescript
fastify.get('/api/custom', async (request, reply) => {
  // Access the Replayly client
  const context = fastify.replayly.getContext()
  
  // Add custom metadata
  context.metadata.userId = request.user.id
  
  return { success: true }
})
```
```

### 1.2 Next.js Integration

**packages/nextjs/src/middleware.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ReplaylyClient, ReplaylyConfig } from '@replayly/sdk'

export interface ReplaylyNextConfig extends ReplaylyConfig {
  ignoreRoutes?: string[]
  captureSearchParams?: boolean
}

let client: ReplaylyClient | null = null

export function createReplaylyMiddleware(config: ReplaylyNextConfig) {
  if (!client) {
    client = new ReplaylyClient(config)
    client.init()
  }

  return async function replaylyMiddleware(request: NextRequest) {
    // Skip ignored routes
    if (config.ignoreRoutes?.some(route => request.nextUrl.pathname.startsWith(route))) {
      return NextResponse.next()
    }

    const context = client!.createContext({
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      query: config.captureSearchParams !== false 
        ? Object.fromEntries(request.nextUrl.searchParams.entries())
        : {},
      body: null, // Body handling is complex in Next.js middleware
    })

    // Store context in headers for API routes to access
    const response = NextResponse.next()
    response.headers.set('x-replayly-context-id', context.requestId)

    return response
  }
}

export function getReplaylyClient(): ReplaylyClient | null {
  return client
}
```

**packages/nextjs/src/api-wrapper.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ReplaylyClient } from '@replayly/sdk'

export function withReplayly(
  handler: (req: NextRequest) => Promise<NextResponse>,
  client: ReplaylyClient
) {
  return async (req: NextRequest) => {
    const context = client.createContext({
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
      body: req.body ? await req.json() : null,
    })

    try {
      const response = await client.runInContext(context, () => handler(req))

      // Capture response
      context.response = {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.clone().json().catch(() => null),
      }

      context.durationMs = Date.now() - context.startTime

      await client.sendEvent(context)

      return response
    } catch (error: any) {
      context.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      }

      context.durationMs = Date.now() - context.startTime

      await client.sendEvent(context)

      throw error
    }
  }
}
```

**packages/nextjs/README.md:**

```markdown
# @replayly/nextjs

Replayly integration for Next.js applications (App Router).

## Installation

```bash
npm install @replayly/nextjs @replayly/sdk
```

## Usage

### Middleware (App Router)

Create `middleware.ts` in your project root:

```typescript
import { createReplaylyMiddleware } from '@replayly/nextjs'

export const middleware = createReplaylyMiddleware({
  apiKey: process.env.REPLAYLY_API_KEY!,
  environment: process.env.NODE_ENV!,
  maskFields: ['password', 'token'],
  ignoreRoutes: ['/_next', '/api/health'],
  captureSearchParams: true
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### API Routes

Wrap your API route handlers:

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withReplayly, getReplaylyClient } from '@replayly/nextjs'

async function handler(req: NextRequest) {
  // Your API logic
  return NextResponse.json({ users: [] })
}

export const GET = withReplayly(handler, getReplaylyClient()!)
```

### Server Actions

```typescript
'use server'

import { getReplaylyClient } from '@replayly/nextjs'

export async function createUser(formData: FormData) {
  const client = getReplaylyClient()
  
  // Track custom operation
  await client?.trackOperation('create_user', async () => {
    // Your server action logic
  })
}
```
```

### 1.3 NestJS Module

**packages/nestjs/src/replayly.module.ts:**

```typescript
import { Module, DynamicModule, Global } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ReplaylyClient, ReplaylyConfig } from '@replayly/sdk'
import { ReplaylyInterceptor } from './replayly.interceptor'
import { ReplaylyService } from './replayly.service'

export interface ReplaylyModuleOptions extends ReplaylyConfig {
  isGlobal?: boolean
}

@Global()
@Module({})
export class ReplaylyModule {
  static forRoot(options: ReplaylyModuleOptions): DynamicModule {
    const client = new ReplaylyClient(options)

    return {
      module: ReplaylyModule,
      global: options.isGlobal !== false,
      providers: [
        {
          provide: 'REPLAYLY_CLIENT',
          useValue: client,
        },
        ReplaylyService,
        {
          provide: APP_INTERCEPTOR,
          useClass: ReplaylyInterceptor,
        },
      ],
      exports: [ReplaylyService, 'REPLAYLY_CLIENT'],
    }
  }
}
```

**packages/nestjs/src/replayly.interceptor.ts:**

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common'
import { Observable, throwError } from 'rxjs'
import { tap, catchError } from 'rxjs/operators'
import { ReplaylyClient } from '@replayly/sdk'

@Injectable()
export class ReplaylyInterceptor implements NestInterceptor {
  constructor(
    @Inject('REPLAYLY_CLIENT')
    private readonly client: ReplaylyClient
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()

    const replaylyContext = this.client.createContext({
      method: request.method,
      url: request.url,
      headers: request.headers,
      query: request.query,
      body: request.body,
    })

    return this.client.runInContext(replaylyContext, () => {
      return next.handle().pipe(
        tap((data) => {
          replaylyContext.response = {
            statusCode: response.statusCode,
            headers: response.getHeaders(),
            body: data,
          }

          replaylyContext.durationMs = Date.now() - replaylyContext.startTime

          this.client.sendEvent(replaylyContext)
        }),
        catchError((error) => {
          replaylyContext.error = {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }

          replaylyContext.durationMs = Date.now() - replaylyContext.startTime

          this.client.sendEvent(replaylyContext)

          return throwError(() => error)
        })
      )
    })
  }
}
```

**packages/nestjs/src/replayly.service.ts:**

```typescript
import { Injectable, Inject } from '@nestjs/common'
import { ReplaylyClient } from '@replayly/sdk'

@Injectable()
export class ReplaylyService {
  constructor(
    @Inject('REPLAYLY_CLIENT')
    private readonly client: ReplaylyClient
  ) {}

  getContext() {
    return this.client.getContext()
  }

  async trackOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const context = this.client.getContext()
    if (!context) return fn()

    const operation = {
      type: 'custom',
      name,
      startTime: Date.now(),
    }

    try {
      const result = await fn()
      operation.durationMs = Date.now() - operation.startTime
      context.operations.push(operation)
      return result
    } catch (error: any) {
      operation.durationMs = Date.now() - operation.startTime
      operation.error = {
        message: error.message,
        stack: error.stack,
      }
      context.operations.push(operation)
      throw error
    }
  }

  addBreadcrumb(message: string, metadata?: any) {
    const context = this.client.getContext()
    if (context) {
      context.breadcrumbs = context.breadcrumbs || []
      context.breadcrumbs.push({
        message,
        timestamp: new Date(),
        metadata,
      })
    }
  }

  setUser(user: { id: string; email?: string; name?: string }) {
    const context = this.client.getContext()
    if (context) {
      context.user = user
    }
  }
}
```

---

## Part 2: ORM Instrumentation

### 2.1 Prisma Instrumentation

**packages/sdk/src/instrumentation/prisma.ts:**

```typescript
import { PrismaClient } from '@prisma/client'
import { ReplaylyClient } from '../core/client'

export function instrumentPrisma(prisma: PrismaClient, client: ReplaylyClient) {
  // Use Prisma middleware to intercept queries
  prisma.$use(async (params, next) => {
    const context = client.getContext()
    if (!context) return next(params)

    const operation = {
      type: 'prisma',
      model: params.model,
      action: params.action,
      startTime: Date.now(),
      durationMs: 0,
    }

    try {
      const result = await next(params)
      operation.durationMs = Date.now() - operation.startTime
      context.operations.push(operation)
      return result
    } catch (error: any) {
      operation.durationMs = Date.now() - operation.startTime
      operation.error = {
        message: error.message,
        code: error.code,
      }
      context.operations.push(operation)
      throw error
    }
  })

  return prisma
}
```

**Usage:**

```typescript
import { PrismaClient } from '@prisma/client'
import { ReplaylyClient } from '@replayly/sdk'
import { instrumentPrisma } from '@replayly/sdk/instrumentation/prisma'

const replayly = new ReplaylyClient({ apiKey: '...' })
const prisma = instrumentPrisma(new PrismaClient(), replayly)

// Now all Prisma queries will be tracked
const users = await prisma.user.findMany()
```

### 2.2 Mongoose Instrumentation

**packages/sdk/src/instrumentation/mongoose.ts:**

```typescript
import mongoose from 'mongoose'
import { ReplaylyClient } from '../core/client'

export function instrumentMongoose(client: ReplaylyClient) {
  // Hook into mongoose query execution
  mongoose.plugin((schema) => {
    schema.pre(/^(find|save|update|remove|delete)/, function (next) {
      const context = client.getContext()
      if (!context) return next()

      const operation = {
        type: 'mongoose',
        model: this.constructor.modelName || 'Unknown',
        action: this.op || 'unknown',
        startTime: Date.now(),
        durationMs: 0,
      }

      // Store operation reference
      ;(this as any)._replaylyOperation = operation

      next()
    })

    schema.post(/^(find|save|update|remove|delete)/, function (result, next) {
      const operation = (this as any)._replaylyOperation
      if (operation) {
        const context = client.getContext()
        if (context) {
          operation.durationMs = Date.now() - operation.startTime
          context.operations.push(operation)
        }
      }
      next()
    })

    schema.post(/^(find|save|update|remove|delete)/, function (error, doc, next) {
      const operation = (this as any)._replaylyOperation
      if (operation) {
        const context = client.getContext()
        if (context) {
          operation.durationMs = Date.now() - operation.startTime
          operation.error = {
            message: error.message,
            code: error.code,
          }
          context.operations.push(operation)
        }
      }
      next(error)
    })
  })
}
```

### 2.3 TypeORM Instrumentation

**packages/sdk/src/instrumentation/typeorm.ts:**

```typescript
import { DataSource, EntitySubscriberInterface, EventSubscriber } from 'typeorm'
import { ReplaylyClient } from '../core/client'

@EventSubscriber()
export class ReplaylySubscriber implements EntitySubscriberInterface {
  constructor(private client: ReplaylyClient) {}

  beforeQuery(event: any) {
    const context = this.client.getContext()
    if (!context) return

    const operation = {
      type: 'typeorm',
      query: event.query,
      parameters: event.parameters,
      startTime: Date.now(),
      durationMs: 0,
    }

    // Store operation in event
    event._replaylyOperation = operation
  }

  afterQuery(event: any) {
    const operation = event._replaylyOperation
    if (!operation) return

    const context = this.client.getContext()
    if (context) {
      operation.durationMs = Date.now() - operation.startTime
      context.operations.push(operation)
    }
  }

  queryError(error: any, event: any) {
    const operation = event._replaylyOperation
    if (!operation) return

    const context = this.client.getContext()
    if (context) {
      operation.durationMs = Date.now() - operation.startTime
      operation.error = {
        message: error.message,
      }
      context.operations.push(operation)
    }
  }
}

export function instrumentTypeORM(dataSource: DataSource, client: ReplaylyClient) {
  dataSource.subscribers.push(new ReplaylySubscriber(client))
  return dataSource
}
```

---

## Part 3: Protocol Instrumentation

### 3.1 GraphQL Instrumentation

**packages/sdk/src/instrumentation/graphql.ts:**

```typescript
import { GraphQLResolveInfo } from 'graphql'
import { ReplaylyClient } from '../core/client'

export interface GraphQLOperation {
  type: 'graphql'
  operationType: 'query' | 'mutation' | 'subscription'
  operationName?: string
  fieldName: string
  parentType: string
  returnType: string
  args: any
  startTime: number
  durationMs: number
  error?: any
}

export function createGraphQLPlugin(client: ReplaylyClient) {
  return {
    requestDidStart() {
      return {
        executionDidStart() {
          return {
            willResolveField({ info }: { info: GraphQLResolveInfo }) {
              const context = client.getContext()
              if (!context) return

              const operation: GraphQLOperation = {
                type: 'graphql',
                operationType: info.operation.operation,
                operationName: info.operation.name?.value,
                fieldName: info.fieldName,
                parentType: info.parentType.name,
                returnType: info.returnType.toString(),
                args: info.variableValues,
                startTime: Date.now(),
                durationMs: 0,
              }

              return (error?: Error) => {
                operation.durationMs = Date.now() - operation.startTime

                if (error) {
                  operation.error = {
                    message: error.message,
                    stack: error.stack,
                  }
                }

                context.operations.push(operation)
              }
            },
          }
        },
      }
    },
  }
}
```

**Usage with Apollo Server:**

```typescript
import { ApolloServer } from '@apollo/server'
import { ReplaylyClient } from '@replayly/sdk'
import { createGraphQLPlugin } from '@replayly/sdk/instrumentation/graphql'

const replayly = new ReplaylyClient({ apiKey: '...' })

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [createGraphQLPlugin(replayly)],
})
```

### 3.2 WebSocket Instrumentation

**packages/sdk/src/instrumentation/websocket.ts:**

```typescript
import { WebSocket, WebSocketServer } from 'ws'
import { ReplaylyClient } from '../core/client'

export function instrumentWebSocket(wss: WebSocketServer, client: ReplaylyClient) {
  wss.on('connection', (ws: WebSocket, request: any) => {
    const connectionId = Math.random().toString(36).substring(7)

    // Track connection
    const context = client.createContext({
      method: 'WS',
      url: request.url,
      headers: request.headers,
      metadata: {
        connectionId,
        type: 'websocket_connection',
      },
    })

    client.sendEvent(context)

    // Track messages
    ws.on('message', (data: any) => {
      const messageContext = client.createContext({
        method: 'WS_MESSAGE',
        url: request.url,
        body: data.toString(),
        metadata: {
          connectionId,
          type: 'websocket_message',
          direction: 'incoming',
        },
      })

      client.sendEvent(messageContext)
    })

    // Wrap send method
    const originalSend = ws.send.bind(ws)
    ws.send = function (data: any, callback?: any) {
      const messageContext = client.createContext({
        method: 'WS_MESSAGE',
        url: request.url,
        body: data.toString(),
        metadata: {
          connectionId,
          type: 'websocket_message',
          direction: 'outgoing',
        },
      })

      client.sendEvent(messageContext)

      return originalSend(data, callback)
    }

    // Track disconnection
    ws.on('close', () => {
      const closeContext = client.createContext({
        method: 'WS_CLOSE',
        url: request.url,
        metadata: {
          connectionId,
          type: 'websocket_close',
        },
      })

      client.sendEvent(closeContext)
    })

    // Track errors
    ws.on('error', (error: Error) => {
      const errorContext = client.createContext({
        method: 'WS_ERROR',
        url: request.url,
        error: {
          message: error.message,
          stack: error.stack,
        },
        metadata: {
          connectionId,
          type: 'websocket_error',
        },
      })

      client.sendEvent(errorContext)
    })
  })

  return wss
}
```

### 3.3 gRPC Instrumentation

**packages/sdk/src/instrumentation/grpc.ts:**

```typescript
import * as grpc from '@grpc/grpc-js'
import { ReplaylyClient } from '../core/client'

export function createGRPCInterceptor(client: ReplaylyClient) {
  return (options: any, nextCall: any) => {
    return new grpc.InterceptingCall(nextCall(options), {
      start(metadata, listener, next) {
        const context = client.createContext({
          method: 'GRPC',
          url: options.method_definition.path,
          metadata: {
            type: 'grpc_call',
            service: options.method_definition.service_name,
            method: options.method_definition.method_name,
          },
        })

        const startTime = Date.now()

        const newListener = {
          onReceiveMetadata(metadata: any, next: any) {
            next(metadata)
          },
          onReceiveMessage(message: any, next: any) {
            context.response = {
              body: message,
            }
            next(message)
          },
          onReceiveStatus(status: any, next: any) {
            context.durationMs = Date.now() - startTime
            context.response = context.response || {}
            context.response.statusCode = status.code

            if (status.code !== grpc.status.OK) {
              context.error = {
                message: status.details,
                code: status.code,
              }
            }

            client.sendEvent(context)
            next(status)
          },
        }

        next(metadata, newListener)
      },
      sendMessage(message, next) {
        next(message)
      },
    })
  }
}
```

---

## Part 4: Custom Instrumentation API

### 4.1 Custom Operations

**packages/sdk/src/api/custom-operations.ts:**

```typescript
import { ReplaylyClient } from '../core/client'

export interface CustomOperation {
  type: 'custom'
  name: string
  startTime: number
  durationMs: number
  metadata?: any
  error?: {
    message: string
    stack?: string
  }
}

export class CustomOperations {
  constructor(private client: ReplaylyClient) {}

  /**
   * Track a custom operation
   */
  async trackOperation<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    const context = this.client.getContext()
    if (!context) return fn()

    const operation: CustomOperation = {
      type: 'custom',
      name,
      startTime: Date.now(),
      durationMs: 0,
      metadata,
    }

    try {
      const result = await fn()
      operation.durationMs = Date.now() - operation.startTime
      context.operations.push(operation)
      return result
    } catch (error: any) {
      operation.durationMs = Date.now() - operation.startTime
      operation.error = {
        message: error.message,
        stack: error.stack,
      }
      context.operations.push(operation)
      throw error
    }
  }

  /**
   * Start a custom operation (manual timing)
   */
  startOperation(name: string, metadata?: any): () => void {
    const context = this.client.getContext()
    if (!context) return () => {}

    const operation: CustomOperation = {
      type: 'custom',
      name,
      startTime: Date.now(),
      durationMs: 0,
      metadata,
    }

    return (error?: Error) => {
      operation.durationMs = Date.now() - operation.startTime

      if (error) {
        operation.error = {
          message: error.message,
          stack: error.stack,
        }
      }

      context.operations.push(operation)
    }
  }

  /**
   * Add custom metadata to current context
   */
  addMetadata(key: string, value: any) {
    const context = this.client.getContext()
    if (context) {
      context.metadata = context.metadata || {}
      context.metadata[key] = value
    }
  }

  /**
   * Add custom tags
   */
  addTags(tags: Record<string, string>) {
    const context = this.client.getContext()
    if (context) {
      context.tags = { ...context.tags, ...tags }
    }
  }
}
```

### 4.2 Breadcrumbs

**packages/sdk/src/api/breadcrumbs.ts:**

```typescript
import { ReplaylyClient } from '../core/client'

export interface Breadcrumb {
  message: string
  level: 'debug' | 'info' | 'warning' | 'error'
  category?: string
  timestamp: Date
  metadata?: any
}

export class Breadcrumbs {
  constructor(private client: ReplaylyClient) {}

  /**
   * Add a breadcrumb to the current context
   */
  add(message: string, options?: {
    level?: Breadcrumb['level']
    category?: string
    metadata?: any
  }) {
    const context = this.client.getContext()
    if (!context) return

    context.breadcrumbs = context.breadcrumbs || []

    const breadcrumb: Breadcrumb = {
      message,
      level: options?.level || 'info',
      category: options?.category,
      timestamp: new Date(),
      metadata: options?.metadata,
    }

    context.breadcrumbs.push(breadcrumb)

    // Limit breadcrumbs to prevent memory issues
    if (context.breadcrumbs.length > 100) {
      context.breadcrumbs = context.breadcrumbs.slice(-100)
    }
  }

  /**
   * Convenience methods
   */
  debug(message: string, metadata?: any) {
    this.add(message, { level: 'debug', metadata })
  }

  info(message: string, metadata?: any) {
    this.add(message, { level: 'info', metadata })
  }

  warning(message: string, metadata?: any) {
    this.add(message, { level: 'warning', metadata })
  }

  error(message: string, metadata?: any) {
    this.add(message, { level: 'error', metadata })
  }

  /**
   * Add navigation breadcrumb
   */
  navigation(from: string, to: string) {
    this.add(`Navigation: ${from} → ${to}`, {
      level: 'info',
      category: 'navigation',
      metadata: { from, to },
    })
  }

  /**
   * Add HTTP breadcrumb
   */
  http(method: string, url: string, statusCode: number) {
    this.add(`${method} ${url} → ${statusCode}`, {
      level: statusCode >= 400 ? 'error' : 'info',
      category: 'http',
      metadata: { method, url, statusCode },
    })
  }

  /**
   * Add user action breadcrumb
   */
  userAction(action: string, target?: string) {
    this.add(`User ${action}${target ? ` on ${target}` : ''}`, {
      level: 'info',
      category: 'user',
      metadata: { action, target },
    })
  }
}
```

### 4.3 User Context

**packages/sdk/src/api/user-context.ts:**

```typescript
import { ReplaylyClient } from '../core/client'

export interface UserContext {
  id: string
  email?: string
  name?: string
  username?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
}

export class UserContextManager {
  constructor(private client: ReplaylyClient) {}

  /**
   * Set user context for current request
   */
  setUser(user: UserContext) {
    const context = this.client.getContext()
    if (context) {
      context.user = user
    }
  }

  /**
   * Update user context
   */
  updateUser(updates: Partial<UserContext>) {
    const context = this.client.getContext()
    if (context && context.user) {
      context.user = { ...context.user, ...updates }
    }
  }

  /**
   * Clear user context
   */
  clearUser() {
    const context = this.client.getContext()
    if (context) {
      context.user = undefined
    }
  }

  /**
   * Get current user context
   */
  getUser(): UserContext | undefined {
    const context = this.client.getContext()
    return context?.user
  }
}
```

### 4.4 Enhanced Client API

**packages/sdk/src/core/client.ts (additions):**

```typescript
import { CustomOperations } from '../api/custom-operations'
import { Breadcrumbs } from '../api/breadcrumbs'
import { UserContextManager } from '../api/user-context'

export class ReplaylyClient {
  public customOperations: CustomOperations
  public breadcrumbs: Breadcrumbs
  public userContext: UserContextManager

  constructor(config: ReplaylyConfig) {
    // ... existing code ...

    this.customOperations = new CustomOperations(this)
    this.breadcrumbs = new Breadcrumbs(this)
    this.userContext = new UserContextManager(this)
  }

  // Convenience methods
  async trackOperation<T>(name: string, fn: () => Promise<T>, metadata?: any): Promise<T> {
    return this.customOperations.trackOperation(name, fn, metadata)
  }

  addBreadcrumb(message: string, options?: any) {
    this.breadcrumbs.add(message, options)
  }

  setUser(user: UserContext) {
    this.userContext.setUser(user)
  }
}
```

---

## Part 5: Performance Optimizations

### 5.1 Adaptive Batching

**packages/sdk/src/transport/adaptive-batch.ts:**

```typescript
export interface AdaptiveBatchConfig {
  minBatchSize: number
  maxBatchSize: number
  minFlushInterval: number
  maxFlushInterval: number
  targetLatency: number
}

export class AdaptiveBatcher {
  private queue: any[] = []
  private flushInterval: number
  private timer: NodeJS.Timeout | null = null
  private lastFlushTime: number = Date.now()
  private avgFlushDuration: number = 0

  constructor(
    private config: AdaptiveBatchConfig,
    private onFlush: (events: any[]) => Promise<void>
  ) {
    this.flushInterval = config.minFlushInterval
    this.scheduleFlush()
  }

  add(event: any) {
    this.queue.push(event)

    // Flush immediately if max batch size reached
    if (this.queue.length >= this.config.maxBatchSize) {
      this.flush()
    }
  }

  private scheduleFlush() {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => {
      this.flush()
    }, this.flushInterval)
  }

  private async flush() {
    if (this.queue.length === 0) {
      this.scheduleFlush()
      return
    }

    const events = this.queue.splice(0, this.config.maxBatchSize)
    const flushStart = Date.now()

    try {
      await this.onFlush(events)

      // Calculate flush duration
      const flushDuration = Date.now() - flushStart

      // Update average flush duration (exponential moving average)
      this.avgFlushDuration = this.avgFlushDuration === 0
        ? flushDuration
        : this.avgFlushDuration * 0.7 + flushDuration * 0.3

      // Adjust flush interval based on performance
      this.adjustFlushInterval()

      this.lastFlushTime = Date.now()
    } catch (error) {
      console.error('Flush error:', error)
      // Re-queue events on error
      this.queue.unshift(...events)
    }

    this.scheduleFlush()
  }

  private adjustFlushInterval() {
    // If flush is taking too long, increase interval
    if (this.avgFlushDuration > this.config.targetLatency) {
      this.flushInterval = Math.min(
        this.flushInterval * 1.5,
        this.config.maxFlushInterval
      )
    }
    // If flush is fast, decrease interval
    else if (this.avgFlushDuration < this.config.targetLatency * 0.5) {
      this.flushInterval = Math.max(
        this.flushInterval * 0.8,
        this.config.minFlushInterval
      )
    }
  }

  async shutdown() {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    await this.flush()
  }
}
```

### 5.2 Intelligent Sampling

**packages/sdk/src/sampling/intelligent-sampler.ts:**

```typescript
export interface SamplingConfig {
  defaultRate: number // 0-1
  errorRate: number // Sample rate for errors (usually 1.0)
  slowRequestThreshold: number // ms
  slowRequestRate: number // Sample rate for slow requests
  routes?: {
    [pattern: string]: number // Per-route sampling rates
  }
}

export class IntelligentSampler {
  constructor(private config: SamplingConfig) {}

  shouldSample(context: any): boolean {
    // Always sample errors
    if (context.error || (context.response?.statusCode >= 400)) {
      return Math.random() < this.config.errorRate
    }

    // Sample slow requests
    if (context.durationMs >= this.config.slowRequestThreshold) {
      return Math.random() < this.config.slowRequestRate
    }

    // Check route-specific sampling
    if (this.config.routes) {
      for (const [pattern, rate] of Object.entries(this.config.routes)) {
        if (this.matchesPattern(context.url, pattern)) {
          return Math.random() < rate
        }
      }
    }

    // Default sampling
    return Math.random() < this.config.defaultRate
  }

  private matchesPattern(url: string, pattern: string): boolean {
    // Simple pattern matching (can be enhanced with regex)
    return url.includes(pattern)
  }
}
```

---

## Acceptance Criteria

- [ ] Fastify plugin working with all hooks
- [ ] Next.js middleware and API wrapper functional
- [ ] NestJS module with interceptor working
- [ ] Prisma instrumentation capturing queries
- [ ] Mongoose instrumentation working
- [ ] TypeORM subscriber tracking queries
- [ ] GraphQL plugin capturing resolver operations
- [ ] WebSocket instrumentation tracking connections and messages
- [ ] gRPC interceptor working
- [ ] Custom operations API functional
- [ ] Breadcrumb tracking working
- [ ] User context enrichment working
- [ ] Adaptive batching optimizing performance
- [ ] Intelligent sampling reducing overhead
- [ ] All packages published to npm
- [ ] Comprehensive documentation for each package

---

## Testing Strategy

### Unit Tests
- Framework middleware/plugin logic
- ORM instrumentation hooks
- Protocol interceptors
- Custom API methods
- Sampling logic

### Integration Tests
- Full request lifecycle with each framework
- ORM query tracking
- GraphQL resolver tracking
- WebSocket message tracking
- gRPC call tracking

### Performance Tests
- SDK overhead measurement
- Adaptive batching efficiency
- Memory usage profiling
- Sampling effectiveness

---

## Documentation

Create comprehensive docs for each integration:

1. **Installation guide**
2. **Configuration options**
3. **Usage examples**
4. **Best practices**
5. **Troubleshooting**
6. **Performance considerations**

---

## Deployment Notes

1. Publish all packages to npm
2. Create example repositories for each framework
3. Update main documentation site
4. Create migration guides from core SDK
5. Announce new integrations

---

## Next Steps

After completing Phase 10, proceed to **Phase 11: Enhanced Replay & Debugging** to add advanced replay capabilities.
