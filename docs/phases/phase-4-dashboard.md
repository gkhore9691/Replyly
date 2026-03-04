# Phase 4: Dashboard & Event Viewer

## Overview

Build the web dashboard for viewing, searching, and analyzing captured events. This is the primary user interface where developers will debug production issues by browsing request lifecycles, filtering errors, and examining detailed event data.

**Duration Estimate**: Primary user-facing interface  
**Priority**: Critical - Core product value  
**Dependencies**: Phase 1 (auth & UI foundation), Phase 3 (data storage)

---

## Goals

1. Build project dashboard with event list
2. Create event detail viewer with full request/response data
3. Implement search and filtering:
   - By route, status code, timestamp, environment
   - Full-text search via OpenSearch
   - Error grouping by hash
4. Build event timeline visualization
5. Display performance metrics (duration, error rate)
6. Create API key management interface
7. Implement real-time updates (optional)

---

## Technical Architecture

### Page Structure

```
app/(dashboard)/
├── dashboard/
│   └── [projectId]/
│       ├── page.tsx                    # Event list
│       ├── events/
│       │   └── [eventId]/
│       │       └── page.tsx            # Event detail
│       ├── errors/
│       │   ├── page.tsx                # Error groups
│       │   └── [errorHash]/
│       │       └── page.tsx            # Error group detail
│       ├── analytics/
│       │   └── page.tsx                # Analytics dashboard
│       ├── settings/
│       │   ├── page.tsx                # Project settings
│       │   └── api-keys/
│       │       └── page.tsx            # API key management
│       └── layout.tsx                  # Project layout
```

### Component Structure

```
components/
├── dashboard/
│   ├── event-list.tsx
│   ├── event-filters.tsx
│   ├── event-card.tsx
│   ├── event-detail/
│   │   ├── request-panel.tsx
│   │   ├── response-panel.tsx
│   │   ├── operations-panel.tsx
│   │   ├── stack-trace.tsx
│   │   └── timeline.tsx
│   ├── error-groups/
│   │   ├── error-group-list.tsx
│   │   └── error-group-card.tsx
│   ├── analytics/
│   │   ├── metrics-card.tsx
│   │   ├── chart.tsx
│   │   └── stats-grid.tsx
│   └── api-keys/
│       ├── api-key-list.tsx
│       └── create-api-key-dialog.tsx
```

---

## API Routes

### Event List API

**app/api/projects/[projectId]/events/route.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { mongodb } from '@/lib/db/mongodb'
import { z } from 'zod'

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  route: z.string().optional(),
  statusCode: z.coerce.number().optional(),
  isError: z.coerce.boolean().optional(),
  environment: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  errorHash: z.string().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Verify authentication
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user has access to project
    const hasAccess = await verifyProjectAccess(user.userId, params.projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Parse query parameters
    const searchParams = Object.fromEntries(req.nextUrl.searchParams)
    const query = QuerySchema.parse(searchParams)
    
    // Build MongoDB filter
    const filter: any = {
      projectId: params.projectId,
    }
    
    if (query.route) {
      filter.route = query.route
    }
    
    if (query.statusCode) {
      filter.statusCode = query.statusCode
    }
    
    if (query.isError !== undefined) {
      filter.isError = query.isError
    }
    
    if (query.environment) {
      filter.environment = query.environment
    }
    
    if (query.errorHash) {
      filter.errorHash = query.errorHash
    }
    
    if (query.startDate || query.endDate) {
      filter.timestamp = {}
      if (query.startDate) {
        filter.timestamp.$gte = new Date(query.startDate)
      }
      if (query.endDate) {
        filter.timestamp.$lte = new Date(query.endDate)
      }
    }
    
    // Get events from MongoDB
    const db = await mongodb.getDb()
    const collection = db.collection('events')
    
    const skip = (query.page - 1) * query.limit
    
    const [events, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(query.limit)
        .toArray(),
      collection.countDocuments(filter),
    ])
    
    return NextResponse.json({
      events,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    })
    
  } catch (error: any) {
    console.error('[Events API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Event Detail API

**app/api/projects/[projectId]/events/[eventId]/route.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { mongodb } from '@/lib/db/mongodb'
import { getEventPayload } from '@/lib/storage/minio'

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string; eventId: string } }
) {
  try {
    // Verify authentication and access
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const hasAccess = await verifyProjectAccess(user.userId, params.projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Get event metadata from MongoDB
    const db = await mongodb.getDb()
    const collection = db.collection('events')
    
    const event = await collection.findOne({
      requestId: params.eventId,
      projectId: params.projectId,
    })
    
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    
    // Get full payload from MinIO
    const payload = await getEventPayload(event.s3Pointer)
    
    return NextResponse.json({
      ...event,
      fullPayload: payload,
    })
    
  } catch (error: any) {
    console.error('[Event Detail API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Search API (OpenSearch)

**app/api/projects/[projectId]/search/route.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { searchEvents } from '@/lib/search/opensearch'

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const hasAccess = await verifyProjectAccess(user.userId, params.projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const query = req.nextUrl.searchParams.get('q')
    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }
    
    const results = await searchEvents(params.projectId, query)
    
    return NextResponse.json(results)
    
  } catch (error: any) {
    console.error('[Search API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Error Groups API

**app/api/projects/[projectId]/error-groups/route.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { mongodb } from '@/lib/db/mongodb'

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const hasAccess = await verifyProjectAccess(user.userId, params.projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Aggregate errors by hash
    const db = await mongodb.getDb()
    const collection = db.collection('events')
    
    const errorGroups = await collection
      .aggregate([
        {
          $match: {
            projectId: params.projectId,
            isError: true,
            errorHash: { $exists: true },
          },
        },
        {
          $group: {
            _id: '$errorHash',
            count: { $sum: 1 },
            lastSeen: { $max: '$timestamp' },
            firstSeen: { $min: '$timestamp' },
            errorMessage: { $first: '$errorMessage' },
            route: { $first: '$route' },
            sampleEventId: { $first: '$requestId' },
          },
        },
        {
          $sort: { lastSeen: -1 },
        },
        {
          $limit: 100,
        },
      ])
      .toArray()
    
    return NextResponse.json({
      errorGroups: errorGroups.map(group => ({
        errorHash: group._id,
        count: group.count,
        lastSeen: group.lastSeen,
        firstSeen: group.firstSeen,
        errorMessage: group.errorMessage,
        route: group.route,
        sampleEventId: group.sampleEventId,
      })),
    })
    
  } catch (error: any) {
    console.error('[Error Groups API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Analytics API

**app/api/projects/[projectId]/analytics/route.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { prisma } from '@/lib/db/postgres'

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const hasAccess = await verifyProjectAccess(user.userId, params.projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const days = parseInt(req.nextUrl.searchParams.get('days') || '7')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    
    // Get daily stats from PostgreSQL
    const stats = await prisma.dailyStats.findMany({
      where: {
        projectId: params.projectId,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    })
    
    // Calculate totals
    const totals = stats.reduce(
      (acc, stat) => ({
        totalEvents: acc.totalEvents + stat.totalEvents,
        errorEvents: acc.errorEvents + stat.errorEvents,
        avgDuration: acc.avgDuration + stat.avgDurationMs,
      }),
      { totalEvents: 0, errorEvents: 0, avgDuration: 0 }
    )
    
    return NextResponse.json({
      stats,
      totals: {
        ...totals,
        avgDuration: totals.avgDuration / stats.length,
        errorRate: totals.totalEvents > 0 
          ? (totals.errorEvents / totals.totalEvents) * 100 
          : 0,
      },
    })
    
  } catch (error: any) {
    console.error('[Analytics API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## Dashboard Pages

### Event List Page

**app/(dashboard)/dashboard/[projectId]/page.tsx:**

```typescript
import { EventList } from '@/components/dashboard/event-list'
import { EventFilters } from '@/components/dashboard/event-filters'
import { MetricsGrid } from '@/components/dashboard/analytics/stats-grid'

interface PageProps {
  params: { projectId: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function ProjectDashboard({ params, searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-muted-foreground">
          View and debug captured production requests
        </p>
      </div>
      
      {/* Metrics Overview */}
      <MetricsGrid projectId={params.projectId} />
      
      {/* Filters */}
      <EventFilters />
      
      {/* Event List */}
      <EventList 
        projectId={params.projectId}
        filters={searchParams}
      />
    </div>
  )
}
```

### Event Detail Page

**app/(dashboard)/dashboard/[projectId]/events/[eventId]/page.tsx:**

```typescript
import { notFound } from 'next/navigation'
import { RequestPanel } from '@/components/dashboard/event-detail/request-panel'
import { ResponsePanel } from '@/components/dashboard/event-detail/response-panel'
import { OperationsPanel } from '@/components/dashboard/event-detail/operations-panel'
import { StackTrace } from '@/components/dashboard/event-detail/stack-trace'
import { Timeline } from '@/components/dashboard/event-detail/timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: { projectId: string; eventId: string }
}

async function getEvent(projectId: string, eventId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${projectId}/events/${eventId}`,
    { cache: 'no-store' }
  )
  
  if (!res.ok) return null
  return res.json()
}

export default async function EventDetailPage({ params }: PageProps) {
  const event = await getEvent(params.projectId, params.eventId)
  
  if (!event) {
    notFound()
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/${params.projectId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {event.method} {event.route}
            </h1>
            <Badge variant={event.isError ? 'destructive' : 'default'}>
              {event.statusCode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(event.timestamp).toLocaleString()} • {event.durationMs}ms
          </p>
        </div>
        
        <Button>
          Replay Locally
        </Button>
      </div>
      
      {/* Timeline */}
      <Timeline event={event} />
      
      {/* Error Stack Trace */}
      {event.error && (
        <StackTrace error={event.error} />
      )}
      
      {/* Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RequestPanel event={event} />
        <ResponsePanel event={event} />
      </div>
      
      {/* Operations */}
      <OperationsPanel operations={event.fullPayload.operationDetails} />
    </div>
  )
}
```

---

## Key Components

### Event List Component

**components/dashboard/event-list.tsx:**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { EventCard } from './event-card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface Event {
  requestId: string
  method: string
  route: string
  statusCode: number
  timestamp: string
  durationMs: number
  isError: boolean
  errorMessage?: string
}

interface EventListProps {
  projectId: string
  filters: any
}

export function EventList({ projectId, filters }: EventListProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
  useEffect(() => {
    loadEvents()
  }, [projectId, filters, page])
  
  async function loadEvents() {
    setLoading(true)
    
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '50',
      ...filters,
    })
    
    const res = await fetch(`/api/projects/${projectId}/events?${params}`)
    const data = await res.json()
    
    setEvents(data.events)
    setHasMore(data.pagination.page < data.pagination.pages)
    setLoading(false)
  }
  
  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No events found</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {events.map(event => (
        <EventCard key={event.requestId} event={event} projectId={projectId} />
      ))}
      
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
```

### Event Card Component

**components/dashboard/event-card.tsx:**

```typescript
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertCircle } from 'lucide-react'

interface EventCardProps {
  event: {
    requestId: string
    method: string
    route: string
    statusCode: number
    timestamp: string
    durationMs: number
    isError: boolean
    errorMessage?: string
  }
  projectId: string
}

export function EventCard({ event, projectId }: EventCardProps) {
  return (
    <Link href={`/dashboard/${projectId}/events/${event.requestId}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {event.method}
                </Badge>
                <span className="font-medium">{event.route}</span>
                <Badge variant={event.isError ? 'destructive' : 'default'}>
                  {event.statusCode}
                </Badge>
              </div>
              
              {event.errorMessage && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{event.errorMessage}</span>
                </div>
              )}
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{new Date(event.timestamp).toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{event.durationMs}ms</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

### Request Panel Component

**components/dashboard/event-detail/request-panel.tsx:**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JsonView } from '@/components/ui/json-view'

interface RequestPanelProps {
  event: any
}

export function RequestPanel({ event }: RequestPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Request</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="body">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
            <TabsTrigger value="query">Query</TabsTrigger>
          </TabsList>
          
          <TabsContent value="body" className="mt-4">
            <JsonView data={event.fullPayload.body} />
          </TabsContent>
          
          <TabsContent value="headers" className="mt-4">
            <JsonView data={event.fullPayload.headers} />
          </TabsContent>
          
          <TabsContent value="query" className="mt-4">
            <JsonView data={event.fullPayload.query} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
```

### Operations Panel Component

**components/dashboard/event-detail/operations-panel.tsx:**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, Globe, Layers } from 'lucide-react'

interface OperationsPanelProps {
  operations: {
    dbQueries: Array<any>
    externalCalls: Array<any>
    redisOps: Array<any>
  }
}

export function OperationsPanel({ operations }: OperationsPanelProps) {
  const allOps = [
    ...operations.dbQueries.map(op => ({ ...op, type: 'db' })),
    ...operations.externalCalls.map(op => ({ ...op, type: 'external' })),
    ...operations.redisOps.map(op => ({ ...op, type: 'redis' })),
  ].sort((a, b) => a.timestamp - b.timestamp)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operations ({allOps.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allOps.map((op, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
              <div className="mt-1">
                {op.type === 'db' && <Database className="h-4 w-4" />}
                {op.type === 'external' && <Globe className="h-4 w-4" />}
                {op.type === 'redis' && <Layers className="h-4 w-4" />}
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{op.type}</Badge>
                  {op.command && <span className="font-mono text-sm">{op.command}</span>}
                  {op.method && <span className="font-mono text-sm">{op.method}</span>}
                </div>
                
                {op.query && (
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {op.query}
                  </pre>
                )}
                
                {op.url && (
                  <p className="text-sm text-muted-foreground">{op.url}</p>
                )}
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{op.durationMs}ms</span>
                  {!op.success && (
                    <Badge variant="destructive" className="text-xs">
                      Failed
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Storage Utilities

### MinIO Payload Retrieval

**lib/storage/minio.ts:**

```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { gunzip } from 'zlib'
import { promisify } from 'util'

const gunzipAsync = promisify(gunzip)

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
})

const BUCKET = process.env.S3_BUCKET || 'replayly-events'

export async function getEventPayload(s3Pointer: string): Promise<any> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Pointer,
    })
  )
  
  const compressed = await streamToBuffer(response.Body)
  const decompressed = await gunzipAsync(compressed)
  return JSON.parse(decompressed.toString('utf-8'))
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
```

### OpenSearch Search

**lib/search/opensearch.ts:**

```typescript
import { Client } from '@opensearch-project/opensearch'

const client = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
})

export async function searchEvents(projectId: string, query: string) {
  const index = `events-${projectId}`
  
  const response = await client.search({
    index,
    body: {
      query: {
        multi_match: {
          query,
          fields: ['url', 'route', 'errorMessage'],
          fuzziness: 'AUTO',
        },
      },
      size: 50,
      sort: [{ timestamp: 'desc' }],
    },
  })
  
  return response.body.hits.hits.map((hit: any) => hit._source)
}
```

---

## Testing Strategy

### Unit Tests

- Event filtering logic
- Date range calculations
- Search query building
- Data formatting

### Integration Tests

- Event list API returns correct data
- Event detail API fetches from MongoDB and MinIO
- Search API queries OpenSearch correctly
- Error groups aggregate properly
- Analytics calculations are accurate

### E2E Tests

- User can view event list
- User can filter events
- User can search events
- User can view event details
- User can navigate between pages

---

## Acceptance Criteria

### Event List

- [ ] Displays events in reverse chronological order
- [ ] Shows method, route, status code, timestamp
- [ ] Highlights errors visually
- [ ] Pagination works correctly
- [ ] Filters work (route, status, date range)
- [ ] Search returns relevant results
- [ ] Loading states are smooth

### Event Detail

- [ ] Shows full request/response data
- [ ] Displays all captured operations
- [ ] Shows stack trace for errors
- [ ] Timeline visualizes request lifecycle
- [ ] JSON is formatted and syntax highlighted
- [ ] "Replay Locally" button is visible

### Error Groups

- [ ] Groups errors by hash
- [ ] Shows occurrence count
- [ ] Shows first/last seen timestamps
- [ ] Links to sample event
- [ ] Sorts by most recent

### Analytics

- [ ] Shows total events over time
- [ ] Shows error rate
- [ ] Shows average duration
- [ ] Charts are interactive
- [ ] Data updates daily

### Performance

- [ ] Event list loads in < 1s
- [ ] Event detail loads in < 2s
- [ ] Search returns in < 500ms
- [ ] UI is responsive and smooth

---

## Next Steps

After Phase 4 completion:
- **Phase 5**: Replay Engine & CLI Tool
- Build CLI for local replay
- Implement replay engine
- Create authentication flow for CLI