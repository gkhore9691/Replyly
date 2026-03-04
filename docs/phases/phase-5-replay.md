# Phase 5: Replay Engine & CLI Tool

## Overview

Build the CLI tool that enables developers to replay captured production requests locally. This is the core differentiator of Replayly - allowing deterministic debugging by reconstructing and re-executing production requests in a local development environment.

**Duration Estimate**: Core product differentiator  
**Priority**: Critical - Unique value proposition  
**Dependencies**: Phase 3 (event storage), Phase 4 (event retrieval APIs)

---

## Goals

1. Create `@replayly/cli` npm package
2. Implement CLI authentication flow
3. Build event fetching from API
4. Implement replay engine:
   - Reconstruct HTTP request from captured data
   - Inject into localhost server
   - Support hybrid mode (live replay)
5. Display lifecycle trace output
6. Handle replay configuration
7. Support local port mapping
8. Create comprehensive CLI documentation

---

## Technical Architecture

### CLI Package Structure

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── login.ts              # Authentication
│   │   ├── logout.ts             # Clear credentials
│   │   ├── projects.ts           # List projects
│   │   ├── events.ts             # List/search events
│   │   ├── replay.ts             # Replay command
│   │   └── config.ts             # Configuration management
│   ├── replay/
│   │   ├── engine.ts             # Core replay logic
│   │   ├── request-builder.ts   # Reconstruct HTTP request
│   │   ├── executor.ts           # Execute request
│   │   └── tracer.ts             # Lifecycle tracing
│   ├── auth/
│   │   ├── auth-manager.ts      # Token management
│   │   ├── device-flow.ts       # Device authentication
│   │   └── storage.ts            # Credential storage
│   ├── api/
│   │   ├── client.ts             # API client
│   │   └── endpoints.ts          # API endpoints
│   ├── ui/
│   │   ├── spinner.ts            # Loading indicators
│   │   ├── table.ts              # Data tables
│   │   └── prompts.ts            # User prompts
│   ├── utils/
│   │   ├── config.ts             # Config file management
│   │   └── logger.ts             # Logging
│   └── index.ts                  # CLI entry point
├── bin/
│   └── replayly.js               # Executable
├── package.json
├── tsconfig.json
└── README.md
```

---

## CLI Commands

### 1. Login Command

**packages/cli/src/commands/login.ts:**

```typescript
import { Command } from 'commander'
import { AuthManager } from '../auth/auth-manager'
import { deviceFlow } from '../auth/device-flow'
import chalk from 'chalk'
import ora from 'ora'

export function createLoginCommand() {
  return new Command('login')
    .description('Authenticate with Replayly')
    .action(async () => {
      const spinner = ora('Starting authentication...').start()
      
      try {
        // Initiate device flow
        const { verificationUri, userCode, deviceCode } = await deviceFlow.initiate()
        
        spinner.stop()
        
        console.log()
        console.log(chalk.bold('To authenticate, visit:'))
        console.log(chalk.cyan.underline(verificationUri))
        console.log()
        console.log(chalk.bold('And enter code:'))
        console.log(chalk.yellow.bold(userCode))
        console.log()
        
        spinner.start('Waiting for authentication...')
        
        // Poll for completion
        const token = await deviceFlow.poll(deviceCode)
        
        // Save token
        const authManager = new AuthManager()
        await authManager.saveToken(token)
        
        // Get user info
        const user = await authManager.getCurrentUser()
        
        spinner.succeed(chalk.green(`Successfully authenticated as ${user.email}`))
        
      } catch (error: any) {
        spinner.fail(chalk.red(`Authentication failed: ${error.message}`))
        process.exit(1)
      }
    })
}
```

### 2. Replay Command

**packages/cli/src/commands/replay.ts:**

```typescript
import { Command } from 'commander'
import { ReplayEngine } from '../replay/engine'
import { AuthManager } from '../auth/auth-manager'
import { ApiClient } from '../api/client'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'

export function createReplayCommand() {
  return new Command('replay')
    .description('Replay a captured event locally')
    .option('-e, --event-id <id>', 'Event ID to replay')
    .option('-p, --port <port>', 'Local server port', '3000')
    .option('--host <host>', 'Local server host', 'localhost')
    .option('--https', 'Use HTTPS', false)
    .option('--dry-run', 'Show request without executing', false)
    .action(async (options) => {
      const authManager = new AuthManager()
      
      // Check authentication
      if (!authManager.isAuthenticated()) {
        console.error(chalk.red('Not authenticated. Run: replayly login'))
        process.exit(1)
      }
      
      let eventId = options.eventId
      
      // If no event ID, prompt user to select
      if (!eventId) {
        eventId = await promptForEvent()
      }
      
      const spinner = ora('Fetching event data...').start()
      
      try {
        // Fetch event from API
        const apiClient = new ApiClient(authManager.getToken()!)
        const event = await apiClient.getEvent(eventId)
        
        spinner.succeed('Event data fetched')
        
        // Display event info
        console.log()
        console.log(chalk.bold('Event Details:'))
        console.log(`  Method: ${chalk.cyan(event.method)}`)
        console.log(`  Route: ${chalk.cyan(event.route)}`)
        console.log(`  Status: ${chalk.yellow(event.statusCode)}`)
        console.log(`  Duration: ${event.durationMs}ms`)
        console.log(`  Timestamp: ${new Date(event.timestamp).toLocaleString()}`)
        console.log()
        
        if (options.dryRun) {
          console.log(chalk.bold('Request Preview:'))
          console.log(JSON.stringify(event.fullPayload, null, 2))
          return
        }
        
        // Confirm replay
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Replay this request to ${options.host}:${options.port}?`,
            default: true,
          },
        ])
        
        if (!confirm) {
          console.log(chalk.yellow('Replay cancelled'))
          return
        }
        
        // Execute replay
        const engine = new ReplayEngine({
          host: options.host,
          port: parseInt(options.port),
          https: options.https,
        })
        
        spinner.start('Replaying request...')
        
        const result = await engine.replay(event)
        
        spinner.succeed('Replay completed')
        
        // Display results
        displayReplayResult(result, event)
        
      } catch (error: any) {
        spinner.fail(chalk.red(`Replay failed: ${error.message}`))
        console.error(error)
        process.exit(1)
      }
    })
}

async function promptForEvent(): Promise<string> {
  const authManager = new AuthManager()
  const apiClient = new ApiClient(authManager.getToken()!)
  
  // Get recent events
  const spinner = ora('Fetching recent events...').start()
  const events = await apiClient.getRecentEvents()
  spinner.stop()
  
  const { eventId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'eventId',
      message: 'Select an event to replay:',
      choices: events.map((event: any) => ({
        name: `${event.method} ${event.route} - ${event.statusCode} (${new Date(event.timestamp).toLocaleString()})`,
        value: event.requestId,
      })),
    },
  ])
  
  return eventId
}

function displayReplayResult(result: any, originalEvent: any) {
  console.log()
  console.log(chalk.bold('Replay Results:'))
  console.log()
  
  // Response comparison
  console.log(chalk.bold('Response:'))
  console.log(`  Status: ${chalk.yellow(result.statusCode)} ${result.statusCode === originalEvent.statusCode ? chalk.green('✓') : chalk.red('✗ (original: ' + originalEvent.statusCode + ')')}`)
  console.log(`  Duration: ${result.durationMs}ms ${chalk.gray(`(original: ${originalEvent.durationMs}ms)`)}`)
  console.log()
  
  // Operations comparison
  if (result.operations) {
    console.log(chalk.bold('Operations:'))
    console.log(`  DB Queries: ${result.operations.dbQueries} ${chalk.gray(`(original: ${originalEvent.operations.dbQueries})`)}`)
    console.log(`  External Calls: ${result.operations.externalCalls} ${chalk.gray(`(original: ${originalEvent.operations.externalCalls})`)}`)
    console.log(`  Redis Ops: ${result.operations.redisOps} ${chalk.gray(`(original: ${originalEvent.operations.redisOps})`)}`)
    console.log()
  }
  
  // Lifecycle trace
  if (result.trace) {
    console.log(chalk.bold('Lifecycle Trace:'))
    result.trace.forEach((step: any) => {
      console.log(`  ${chalk.gray(step.timestamp)} ${step.event}`)
    })
    console.log()
  }
  
  // Differences
  if (result.differences && result.differences.length > 0) {
    console.log(chalk.yellow.bold('⚠ Differences Detected:'))
    result.differences.forEach((diff: string) => {
      console.log(`  ${chalk.yellow('•')} ${diff}`)
    })
    console.log()
  }
}
```

### 3. Events Command

**packages/cli/src/commands/events.ts:**

```typescript
import { Command } from 'commander'
import { AuthManager } from '../auth/auth-manager'
import { ApiClient } from '../api/client'
import chalk from 'chalk'
import Table from 'cli-table3'
import ora from 'ora'

export function createEventsCommand() {
  return new Command('events')
    .description('List captured events')
    .option('-p, --project <id>', 'Project ID')
    .option('-l, --limit <number>', 'Number of events to show', '20')
    .option('--errors-only', 'Show only errors', false)
    .option('--route <route>', 'Filter by route')
    .action(async (options) => {
      const authManager = new AuthManager()
      
      if (!authManager.isAuthenticated()) {
        console.error(chalk.red('Not authenticated. Run: replayly login'))
        process.exit(1)
      }
      
      const spinner = ora('Fetching events...').start()
      
      try {
        const apiClient = new ApiClient(authManager.getToken()!)
        
        const events = await apiClient.getEvents({
          projectId: options.project,
          limit: parseInt(options.limit),
          isError: options.errorsOnly ? true : undefined,
          route: options.route,
        })
        
        spinner.stop()
        
        if (events.length === 0) {
          console.log(chalk.yellow('No events found'))
          return
        }
        
        // Display as table
        const table = new Table({
          head: ['ID', 'Method', 'Route', 'Status', 'Duration', 'Time'],
          colWidths: [15, 8, 30, 8, 10, 20],
        })
        
        events.forEach((event: any) => {
          table.push([
            event.requestId.substring(0, 12) + '...',
            event.method,
            event.route,
            event.isError ? chalk.red(event.statusCode) : chalk.green(event.statusCode),
            `${event.durationMs}ms`,
            new Date(event.timestamp).toLocaleTimeString(),
          ])
        })
        
        console.log(table.toString())
        console.log()
        console.log(chalk.gray(`Showing ${events.length} events`))
        
      } catch (error: any) {
        spinner.fail(chalk.red(`Failed to fetch events: ${error.message}`))
        process.exit(1)
      }
    })
}
```

---

## Replay Engine

### Core Engine

**packages/cli/src/replay/engine.ts:**

```typescript
import axios, { AxiosResponse } from 'axios'
import { RequestBuilder } from './request-builder'
import { Tracer } from './tracer'

interface ReplayConfig {
  host: string
  port: number
  https: boolean
}

interface ReplayResult {
  statusCode: number
  durationMs: number
  operations?: {
    dbQueries: number
    externalCalls: number
    redisOps: number
  }
  trace?: Array<any>
  differences?: string[]
  response?: any
}

export class ReplayEngine {
  private config: ReplayConfig
  private tracer: Tracer
  
  constructor(config: ReplayConfig) {
    this.config = config
    this.tracer = new Tracer()
  }
  
  async replay(event: any): Promise<ReplayResult> {
    const startTime = Date.now()
    
    // Build request
    const requestBuilder = new RequestBuilder(event)
    const request = requestBuilder.build()
    
    // Construct URL
    const protocol = this.config.https ? 'https' : 'http'
    const url = `${protocol}://${this.config.host}:${this.config.port}${request.path}`
    
    this.tracer.log('request_start', { url, method: request.method })
    
    try {
      // Execute request
      const response = await axios({
        method: request.method,
        url,
        headers: request.headers,
        params: request.query,
        data: request.body,
        validateStatus: () => true, // Don't throw on any status
        maxRedirects: 0, // Don't follow redirects
      })
      
      const durationMs = Date.now() - startTime
      
      this.tracer.log('request_complete', {
        statusCode: response.status,
        durationMs,
      })
      
      // Compare with original
      const differences = this.compareResults(event, response, durationMs)
      
      return {
        statusCode: response.status,
        durationMs,
        trace: this.tracer.getTrace(),
        differences,
        response: response.data,
      }
      
    } catch (error: any) {
      this.tracer.log('request_error', { error: error.message })
      
      throw new Error(`Replay failed: ${error.message}`)
    }
  }
  
  private compareResults(
    original: any,
    response: AxiosResponse,
    durationMs: number
  ): string[] {
    const differences: string[] = []
    
    // Compare status code
    if (response.status !== original.statusCode) {
      differences.push(
        `Status code mismatch: got ${response.status}, expected ${original.statusCode}`
      )
    }
    
    // Compare duration (allow 50% variance)
    const durationDiff = Math.abs(durationMs - original.durationMs)
    const durationVariance = durationDiff / original.durationMs
    
    if (durationVariance > 0.5) {
      differences.push(
        `Duration variance: ${Math.round(durationVariance * 100)}% (${durationMs}ms vs ${original.durationMs}ms)`
      )
    }
    
    return differences
  }
}
```

### Request Builder

**packages/cli/src/replay/request-builder.ts:**

```typescript
export class RequestBuilder {
  private event: any
  
  constructor(event: any) {
    this.event = event
  }
  
  build() {
    const payload = this.event.fullPayload
    
    // Extract path from URL
    const url = new URL(payload.url)
    
    // Build headers (filter out host, connection, etc.)
    const headers = this.filterHeaders(payload.headers)
    
    return {
      method: payload.method,
      path: url.pathname + url.search,
      headers,
      query: payload.query,
      body: payload.body,
    }
  }
  
  private filterHeaders(headers: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {}
    
    // Headers to exclude
    const excludeHeaders = [
      'host',
      'connection',
      'content-length',
      'transfer-encoding',
      'x-forwarded-for',
      'x-forwarded-proto',
      'x-real-ip',
    ]
    
    for (const [key, value] of Object.entries(headers)) {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        filtered[key] = value
      }
    }
    
    return filtered
  }
}
```

### Tracer

**packages/cli/src/replay/tracer.ts:**

```typescript
export class Tracer {
  private trace: Array<{ timestamp: string; event: string; data?: any }> = []
  
  log(event: string, data?: any) {
    this.trace.push({
      timestamp: new Date().toISOString(),
      event,
      data,
    })
  }
  
  getTrace() {
    return this.trace
  }
  
  clear() {
    this.trace = []
  }
}
```

---

## Authentication

### Auth Manager

**packages/cli/src/auth/auth-manager.ts:**

```typescript
import { CredentialStorage } from './storage'

interface Token {
  accessToken: string
  expiresAt: number
}

interface User {
  id: string
  email: string
  name: string
}

export class AuthManager {
  private storage: CredentialStorage
  
  constructor() {
    this.storage = new CredentialStorage()
  }
  
  async saveToken(token: Token) {
    await this.storage.save('token', token)
  }
  
  getToken(): string | null {
    const token = this.storage.get('token')
    
    if (!token) return null
    
    // Check expiration
    if (Date.now() > token.expiresAt) {
      this.storage.delete('token')
      return null
    }
    
    return token.accessToken
  }
  
  isAuthenticated(): boolean {
    return this.getToken() !== null
  }
  
  async getCurrentUser(): Promise<User> {
    const token = this.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }
    
    // Fetch user from API
    const response = await fetch(`${process.env.API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch user')
    }
    
    const data = await response.json()
    return data.user
  }
  
  async logout() {
    this.storage.delete('token')
  }
}
```

### Device Flow

**packages/cli/src/auth/device-flow.ts:**

```typescript
import axios from 'axios'

const API_URL = process.env.API_URL || 'https://api.replayly.dev'
const POLL_INTERVAL = 5000 // 5 seconds
const TIMEOUT = 300000 // 5 minutes

interface DeviceFlowInitiation {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
}

class DeviceFlow {
  async initiate(): Promise<DeviceFlowInitiation> {
    const response = await axios.post(`${API_URL}/api/auth/device/code`)
    return response.data
  }
  
  async poll(deviceCode: string): Promise<{ accessToken: string; expiresAt: number }> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < TIMEOUT) {
      try {
        const response = await axios.post(`${API_URL}/api/auth/device/token`, {
          deviceCode,
        })
        
        if (response.data.accessToken) {
          return {
            accessToken: response.data.accessToken,
            expiresAt: Date.now() + response.data.expiresIn * 1000,
          }
        }
      } catch (error: any) {
        if (error.response?.status === 428) {
          // Pending - continue polling
          await this.sleep(POLL_INTERVAL)
          continue
        }
        
        throw error
      }
    }
    
    throw new Error('Authentication timeout')
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const deviceFlow = new DeviceFlow()
```

### Credential Storage

**packages/cli/src/auth/storage.ts:**

```typescript
import os from 'os'
import path from 'path'
import fs from 'fs'

const CONFIG_DIR = path.join(os.homedir(), '.replayly')
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json')

export class CredentialStorage {
  constructor() {
    this.ensureConfigDir()
  }
  
  private ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
    }
  }
  
  save(key: string, value: any) {
    const data = this.loadAll()
    data[key] = value
    
    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(data, null, 2),
      { mode: 0o600 }
    )
  }
  
  get(key: string): any {
    const data = this.loadAll()
    return data[key]
  }
  
  delete(key: string) {
    const data = this.loadAll()
    delete data[key]
    
    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(data, null, 2),
      { mode: 0o600 }
    )
  }
  
  private loadAll(): Record<string, any> {
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return {}
    }
    
    const content = fs.readFileSync(CREDENTIALS_FILE, 'utf-8')
    return JSON.parse(content)
  }
}
```

---

## API Client

**packages/cli/src/api/client.ts:**

```typescript
import axios, { AxiosInstance } from 'axios'

const API_URL = process.env.API_URL || 'https://api.replayly.dev'

export class ApiClient {
  private client: AxiosInstance
  
  constructor(token: string) {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }
  
  async getEvent(eventId: string) {
    // First get user's projects
    const projects = await this.getProjects()
    
    if (projects.length === 0) {
      throw new Error('No projects found')
    }
    
    // Search for event across projects
    for (const project of projects) {
      try {
        const response = await this.client.get(
          `/api/projects/${project.id}/events/${eventId}`
        )
        return response.data
      } catch (error: any) {
        if (error.response?.status === 404) {
          continue
        }
        throw error
      }
    }
    
    throw new Error('Event not found')
  }
  
  async getEvents(options: {
    projectId?: string
    limit?: number
    isError?: boolean
    route?: string
  }) {
    const projectId = options.projectId || (await this.getDefaultProject()).id
    
    const response = await this.client.get(`/api/projects/${projectId}/events`, {
      params: {
        limit: options.limit || 20,
        isError: options.isError,
        route: options.route,
      },
    })
    
    return response.data.events
  }
  
  async getRecentEvents() {
    return this.getEvents({ limit: 20 })
  }
  
  async getProjects() {
    const response = await this.client.get('/api/projects')
    return response.data.projects
  }
  
  async getDefaultProject() {
    const projects = await this.getProjects()
    
    if (projects.length === 0) {
      throw new Error('No projects found')
    }
    
    return projects[0]
  }
}
```

---

## CLI Entry Point

**packages/cli/src/index.ts:**

```typescript
#!/usr/bin/env node

import { Command } from 'commander'
import { createLoginCommand } from './commands/login'
import { createLogoutCommand } from './commands/logout'
import { createProjectsCommand } from './commands/projects'
import { createEventsCommand } from './commands/events'
import { createReplayCommand } from './commands/replay'

const program = new Command()

program
  .name('replayly')
  .description('Replayly CLI - Replay production requests locally')
  .version('0.1.0')

// Add commands
program.addCommand(createLoginCommand())
program.addCommand(createLogoutCommand())
program.addCommand(createProjectsCommand())
program.addCommand(createEventsCommand())
program.addCommand(createReplayCommand())

program.parse()
```

---

## Backend Support (Device Flow)

### Device Code Endpoint

**app/api/auth/device/code/route.ts:**

```typescript
import { NextResponse } from 'next/server'
import { generateDeviceCode } from '@/lib/auth/device-flow'

export async function POST() {
  const { deviceCode, userCode, expiresIn } = await generateDeviceCode()
  
  return NextResponse.json({
    deviceCode,
    userCode,
    verificationUri: `${process.env.NEXT_PUBLIC_APP_URL}/device`,
    expiresIn,
  })
}
```

### Device Token Endpoint

**app/api/auth/device/token/route.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { checkDeviceCode } from '@/lib/auth/device-flow'

export async function POST(req: NextRequest) {
  const { deviceCode } = await req.json()
  
  const result = await checkDeviceCode(deviceCode)
  
  if (result.status === 'pending') {
    return NextResponse.json(
      { error: 'authorization_pending' },
      { status: 428 }
    )
  }
  
  if (result.status === 'expired') {
    return NextResponse.json(
      { error: 'expired_token' },
      { status: 400 }
    )
  }
  
  if (result.status === 'approved') {
    return NextResponse.json({
      accessToken: result.token,
      expiresIn: 604800, // 7 days
    })
  }
  
  return NextResponse.json(
    { error: 'invalid_grant' },
    { status: 400 }
  )
}
```

---

## Package Configuration

**packages/cli/package.json:**

```json
{
  "name": "@replayly/cli",
  "version": "0.1.0",
  "description": "Replayly CLI for replaying production requests locally",
  "bin": {
    "replayly": "./bin/replayly.js"
  },
  "files": ["dist", "bin"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "commander": "^11.1.0",
    "axios": "^1.6.8",
    "chalk": "^4.1.2",
    "ora": "^5.4.1",
    "inquirer": "^8.2.6",
    "cli-table3": "^0.6.3"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/inquirer": "^9",
    "typescript": "^5"
  }
}
```

---

## Testing Strategy

### Unit Tests

- Request builder correctly reconstructs requests
- Header filtering works properly
- Tracer logs events correctly
- Auth token validation

### Integration Tests

- Login flow completes successfully
- Events can be fetched from API
- Replay engine sends correct request
- Response comparison works

### E2E Tests

- Full login → list events → replay flow
- CLI handles authentication errors
- CLI handles network errors gracefully

---

## Acceptance Criteria

### Authentication

- [ ] User can log in via device flow
- [ ] Token is stored securely
- [ ] Token expiration is handled
- [ ] User can log out

### Event Management

- [ ] User can list events
- [ ] User can filter events
- [ ] User can search events
- [ ] Event details are displayed correctly

### Replay

- [ ] Request is reconstructed accurately
- [ ] Request is sent to local server
- [ ] Response is captured
- [ ] Comparison with original is shown
- [ ] Differences are highlighted
- [ ] Lifecycle trace is displayed

### User Experience

- [ ] Commands are intuitive
- [ ] Help text is clear
- [ ] Error messages are helpful
- [ ] Loading indicators work
- [ ] Output is well-formatted

### Performance

- [ ] Login completes in < 30s
- [ ] Event list loads in < 2s
- [ ] Replay executes in < 5s

---

## Documentation

### README.md

```markdown
# Replayly CLI

Replay production requests locally for debugging.

## Installation

```bash
npm install -g @replayly/cli
```

## Quick Start

```bash
# Authenticate
replayly login

# List recent events
replayly events

# Replay an event
replayly replay --event-id req_123

# Replay with custom port
replayly replay --event-id req_123 --port 4000
```

## Commands

### `replayly login`
Authenticate with Replayly

### `replayly events`
List captured events

Options:
- `-l, --limit <number>` - Number of events (default: 20)
- `--errors-only` - Show only errors
- `--route <route>` - Filter by route

### `replayly replay`
Replay a captured event

Options:
- `-e, --event-id <id>` - Event ID to replay
- `-p, --port <port>` - Local server port (default: 3000)
- `--host <host>` - Local server host (default: localhost)
- `--https` - Use HTTPS
- `--dry-run` - Show request without executing
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Local server not running | High | Clear error messages, port detection |
| Request differences | Medium | Show comparison, explain determinism limits |
| Authentication complexity | Medium | Simple device flow, clear instructions |
| Network errors | Low | Retry logic, helpful error messages |

---

## Next Steps

After Phase 5 completion:
- **Phase 6**: Release Monitoring & Git Integration
- Implement GitHub webhook handler
- Track deployments and releases
- Correlate errors with releases
