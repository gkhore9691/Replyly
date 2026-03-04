# Phase 1: Foundation & Infrastructure Setup

## Overview

Establish the foundational architecture for Replayly, including project structure, Docker infrastructure, authentication system, and multi-tenant database design.

**Duration Estimate**: Foundation for all subsequent phases  
**Priority**: Critical - Blocking for all other phases

---

## Goals

1. Set up Next.js 14+ project with App Router
2. Configure Docker Compose for all infrastructure services
3. Implement user authentication and authorization
4. Design and implement multi-tenant database schemas
5. Create basic dashboard UI structure with shadcn/ui
6. Establish development workflow and environment

---

## Technical Architecture

### Project Structure

```
replyly/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth routes group
│   │   ├── login/
│   │   ├── signup/
│   │   └── layout.tsx
│   ├── (dashboard)/              # Dashboard routes group
│   │   ├── dashboard/
│   │   │   └── [projectId]/
│   │   └── layout.tsx
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── signup/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── organizations/
│   │   └── projects/
│   └── layout.tsx
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── auth/
│   ├── dashboard/
│   └── layout/
├── lib/                          # Utility libraries
│   ├── auth/
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   └── session.ts
│   ├── db/
│   │   ├── mongodb.ts
│   │   ├── postgres.ts
│   │   └── redis.ts
│   ├── validations/
│   └── utils/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── packages/                     # Monorepo packages
│   ├── sdk/
│   └── cli/
├── workers/                      # Background workers
│   └── event-processor/
├── docker/                       # Docker configs
│   ├── mongodb/
│   ├── postgres/
│   └── opensearch/
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

## Infrastructure Components

### Docker Compose Services

**docker-compose.yml Configuration:**

```yaml
version: '3.8'

services:
  # PostgreSQL - User data, analytics, projects
  postgres:
    image: postgres:16-alpine
    container_name: replayly-postgres
    environment:
      POSTGRES_DB: replayly
      POSTGRES_USER: replayly
      POSTGRES_PASSWORD: replayly_dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U replayly"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MongoDB - Event metadata storage
  mongodb:
    image: mongo:7
    container_name: replayly-mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: replayly
      MONGO_INITDB_ROOT_PASSWORD: replayly_dev_password
      MONGO_INITDB_DATABASE: replayly
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
      - ./docker/mongodb/init.js:/docker-entrypoint-initdb.d/init.js
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis - Queue and caching
  redis:
    image: redis:7-alpine
    container_name: replayly-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MinIO - S3-compatible object storage
  minio:
    image: minio/minio:latest
    container_name: replayly-minio
    environment:
      MINIO_ROOT_USER: replayly
      MINIO_ROOT_PASSWORD: replayly_dev_password
    ports:
      - "9000:9000"      # API
      - "9001:9001"      # Console
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

  # OpenSearch - Full-text search
  opensearch:
    image: opensearchproject/opensearch:2.11.0
    container_name: replayly-opensearch
    environment:
      - discovery.type=single-node
      - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
      - DISABLE_SECURITY_PLUGIN=true
    ports:
      - "9200:9200"
      - "9600:9600"
    volumes:
      - opensearch_data:/usr/share/opensearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  mongodb_data:
  redis_data:
  minio_data:
  opensearch_data:
```

---

## Database Schemas

### PostgreSQL Schema (Prisma)

**prisma/schema.prisma:**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Users
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  name          String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  // Relations
  memberships   OrganizationMember[]
  apiKeys       ApiKey[]
  
  @@map("users")
}

// Organizations (top-level tenant)
model Organization {
  id          String         @id @default(cuid())
  name        String
  slug        String         @unique
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  
  // Relations
  members     OrganizationMember[]
  projects    Project[]
  
  @@map("organizations")
}

// Organization membership
model OrganizationMember {
  id             String       @id @default(cuid())
  role           Role         @default(MEMBER)
  userId         String
  organizationId String
  createdAt      DateTime     @default(now())
  
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([userId, organizationId])
  @@map("organization_members")
}

enum Role {
  OWNER
  ADMIN
  MEMBER
}

// Projects (within organization)
model Project {
  id             String       @id @default(cuid())
  name           String
  slug           String
  organizationId String
  environment    String       @default("production")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  // Settings
  retentionDays  Int          @default(30)
  samplingRate   Float        @default(1.0)
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  apiKeys        ApiKey[]
  releases       Release[]
  
  @@unique([organizationId, slug])
  @@map("projects")
}

// API Keys for SDK authentication
model ApiKey {
  id          String    @id @default(cuid())
  name        String
  keyHash     String    @unique
  keyPrefix   String    // First 8 chars for identification
  projectId   String
  userId      String
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())
  expiresAt   DateTime?
  
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("api_keys")
}

// Release tracking
model Release {
  id          String   @id @default(cuid())
  projectId   String
  version     String
  commitSha   String
  branch      String?
  author      String?
  deployedAt  DateTime @default(now())
  
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@index([projectId, deployedAt])
  @@map("releases")
}

// Analytics aggregations
model DailyStats {
  id              String   @id @default(cuid())
  projectId       String
  date            DateTime @db.Date
  totalEvents     Int      @default(0)
  errorEvents     Int      @default(0)
  avgDurationMs   Float    @default(0)
  p95DurationMs   Float    @default(0)
  p99DurationMs   Float    @default(0)
  
  @@unique([projectId, date])
  @@index([projectId, date])
  @@map("daily_stats")
}
```

### MongoDB Collections

**Events Collection:**

```javascript
// Collection: events
{
  _id: ObjectId,
  
  // Tenant isolation
  organizationId: String,
  projectId: String,
  
  // Request metadata
  method: String,              // GET, POST, etc.
  route: String,               // /api/users/:id
  url: String,                 // Full URL
  statusCode: Number,
  
  // Timing
  timestamp: ISODate,
  durationMs: Number,
  
  // Error tracking
  isError: Boolean,
  errorHash: String,           // SHA256(stackTrace + route)
  errorMessage: String,
  
  // Context
  environment: String,         // production, staging
  userId: String,
  gitCommitSha: String,
  correlationId: String,       // UUID for request tracking
  
  // Storage reference
  s3Pointer: String,           // Path to full payload in MinIO
  
  // Captured operations (summary)
  operations: {
    dbQueries: Number,
    externalCalls: Number,
    redisOps: Number
  },
  
  // Metadata
  createdAt: ISODate,
  
  // Indexes
  // - { projectId: 1, timestamp: -1 }
  // - { projectId: 1, errorHash: 1 }
  // - { projectId: 1, route: 1, timestamp: -1 }
  // - { projectId: 1, statusCode: 1 }
  // - { correlationId: 1 }
}
```

**Indexes:**

```javascript
db.events.createIndex({ projectId: 1, timestamp: -1 })
db.events.createIndex({ projectId: 1, errorHash: 1 })
db.events.createIndex({ projectId: 1, route: 1, timestamp: -1 })
db.events.createIndex({ projectId: 1, statusCode: 1 })
db.events.createIndex({ correlationId: 1 })
db.events.createIndex({ organizationId: 1 })
```

---

## Authentication System

### JWT-Based Authentication

**Token Structure:**

```typescript
interface JWTPayload {
  userId: string
  email: string
  organizationIds: string[]
  iat: number
  exp: number
}
```

**Implementation:**

```typescript
// lib/auth/jwt.ts
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = '7d'

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload
}
```

**Password Hashing:**

```typescript
// lib/auth/password.ts
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

### API Key Authentication (for SDK)

**Format:** `rply_live_<random_32_chars>` or `rply_test_<random_32_chars>`

**Storage:** Hash using SHA256, store only hash and prefix

```typescript
// lib/auth/api-key.ts
import crypto from 'crypto'

export function generateApiKey(environment: 'live' | 'test'): {
  key: string
  hash: string
  prefix: string
} {
  const randomPart = crypto.randomBytes(24).toString('base64url')
  const key = `rply_${environment}_${randomPart}`
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  const prefix = key.substring(0, 12) // rply_live_xx
  
  return { key, hash, prefix }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}
```

---

## API Routes

### Authentication Endpoints

**POST /api/auth/signup**

```typescript
// Request
{
  email: string
  password: string
  name: string
  organizationName: string
}

// Response
{
  user: {
    id: string
    email: string
    name: string
  }
  organization: {
    id: string
    name: string
    slug: string
  }
  token: string
}
```

**POST /api/auth/login**

```typescript
// Request
{
  email: string
  password: string
}

// Response
{
  user: {
    id: string
    email: string
    name: string
  }
  organizations: Array<{
    id: string
    name: string
    role: string
  }>
  token: string
}
```

**GET /api/auth/me**

```typescript
// Headers: Authorization: Bearer <token>

// Response
{
  user: {
    id: string
    email: string
    name: string
  }
  organizations: Array<{
    id: string
    name: string
    role: string
  }>
}
```

### Organization & Project Endpoints

**GET /api/organizations**
- List user's organizations

**POST /api/organizations**
- Create new organization

**GET /api/organizations/:orgId/projects**
- List projects in organization

**POST /api/organizations/:orgId/projects**
- Create new project

**POST /api/projects/:projectId/api-keys**
- Generate new API key

---

## UI Components (shadcn/ui)

### Install shadcn/ui

```bash
npx shadcn-ui@latest init
```

**Components to Install:**

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add form
npx shadcn-ui@latest add select
```

### Dashboard Layout

```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/40">
        <Sidebar />
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Header />
        <div className="container py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
```

---

## Environment Configuration

**.env.local:**

```bash
# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# PostgreSQL
DATABASE_URL=postgresql://replayly:replayly_dev_password@localhost:5432/replayly

# MongoDB
MONGODB_URI=mongodb://replayly:replayly_dev_password@localhost:27017/replayly

# Redis
REDIS_URL=redis://localhost:6379

# MinIO (S3)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=replayly
S3_SECRET_KEY=replayly_dev_password
S3_BUCKET=replayly-events
S3_REGION=us-east-1

# OpenSearch
OPENSEARCH_URL=http://localhost:9200
```

---

## Development Workflow

### Setup Commands

```bash
# Install dependencies
npm install

# Start Docker services
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed database (optional)
npm run db:seed

# Start Next.js dev server
npm run dev
```

### Database Management

```bash
# Create migration
npx prisma migrate dev --name <migration_name>

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# MongoDB shell
docker exec -it replayly-mongodb mongosh -u replayly -p replayly_dev_password
```

---

## Testing Strategy

### Unit Tests

- Authentication utilities (JWT, password hashing)
- API key generation and validation
- Database connection utilities

### Integration Tests

- Auth API endpoints (signup, login, logout)
- Organization and project CRUD
- Multi-tenant isolation

### E2E Tests

- User registration flow
- Login and session management
- Project creation and API key generation

---

## Acceptance Criteria

### Infrastructure

- [ ] Docker Compose successfully starts all services
- [ ] All services pass health checks
- [ ] Services can communicate with each other
- [ ] Data persists across container restarts

### Authentication

- [ ] Users can sign up with email/password
- [ ] Users can log in and receive JWT token
- [ ] JWT tokens are validated on protected routes
- [ ] Passwords are securely hashed (bcrypt)
- [ ] Sessions persist across page refreshes

### Multi-Tenancy

- [ ] Organizations are created on signup
- [ ] Users can belong to multiple organizations
- [ ] Projects are scoped to organizations
- [ ] API keys are scoped to projects
- [ ] Database queries enforce tenant isolation

### UI

- [ ] Login page with form validation
- [ ] Signup page with organization creation
- [ ] Dashboard layout with sidebar and header
- [ ] Organization and project selector
- [ ] API key management interface
- [ ] Responsive design (mobile-friendly)

### Database

- [ ] PostgreSQL schema is created via Prisma
- [ ] MongoDB collections and indexes are created
- [ ] Connections are pooled and reused
- [ ] Queries are optimized with proper indexes

### Developer Experience

- [ ] Hot reload works for Next.js changes
- [ ] Environment variables are properly loaded
- [ ] Error messages are helpful and actionable
- [ ] Documentation is clear and complete

---

## Dependencies

**package.json:**

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@prisma/client": "^5.11.0",
    "mongodb": "^6.5.0",
    "redis": "^4.6.13",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "zod": "^3.22.4",
    "date-fns": "^3.6.0",
    "@radix-ui/react-*": "latest",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.2",
    "lucide-react": "^0.363.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.6",
    "typescript": "^5",
    "prisma": "^5.11.0",
    "tailwindcss": "^3.4.1",
    "postcss": "^8",
    "autoprefixer": "^10.4.19",
    "eslint": "^8",
    "eslint-config-next": "14.2.0"
  }
}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Docker services fail to start | High | Provide detailed troubleshooting guide, health checks |
| Database connection issues | High | Connection pooling, retry logic, health checks |
| JWT secret exposure | Critical | Use strong secrets, document rotation process |
| Multi-tenant data leakage | Critical | Comprehensive integration tests, query middleware |
| Performance issues with MongoDB | Medium | Proper indexing, query optimization |

---

## Next Steps

After Phase 1 completion:
- **Phase 2**: SDK Development & Instrumentation
- Begin building the core SDK package
- Implement AsyncLocalStorage context tracking
- Start instrumentation for HTTP, Axios, MongoDB
