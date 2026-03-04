export interface ReplaylyConfig {
  apiKey: string;
  projectId?: string;
  endpoint?: string;
  environment?: string;
  captureBody?: boolean;
  captureHeaders?: boolean;
  maxPayloadSize?: number;
  sampleRate?: number;
  captureAxios?: boolean;
  captureFetch?: boolean;
  captureMongo?: boolean;
  capturePostgres?: boolean;
  captureRedis?: boolean;
  maskFields?: string[];
  flushInterval?: number;
  maxQueueSize?: number;
}

export interface RequestContext {
  requestId: string;
  startTime: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: unknown;
  body: unknown;
  operations: {
    dbQueries: unknown[];
    externalCalls: unknown[];
    redisOps: unknown[];
  };
  metadata: {
    userId?: string;
    gitCommitSha?: string;
    environment: string;
    [key: string]: unknown;
  };
  _mongoCommands?: Record<string, { command: string; collection: string; startTime: number }>;
  /** Response captured in onResponse / after handler */
  response?: { statusCode?: number; headers?: Record<string, string>; body?: unknown };
  /** Error captured in onError / catch */
  error?: { message: string; stack?: string; name?: string; code?: string };
  /** Duration in ms (set when sending event) */
  durationMs?: number;
  /** Additional operations from ORM/protocol instrumentation */
  operationList?: Array<Record<string, unknown>>;
  /** Breadcrumb trail for debugging */
  breadcrumbs?: Array<{ message: string; level?: string; category?: string; timestamp: Date; metadata?: unknown }>;
  /** User context */
  user?: { id: string; email?: string; name?: string; username?: string; [key: string]: unknown };
  /** Tags for filtering */
  tags?: Record<string, string>;
}

export interface CapturedEvent {
  projectId?: string;
  requestId: string;
  timestamp: string;
  durationMs: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: unknown;
  body: unknown;
  statusCode: number;
  responseBody: unknown;
  isError: boolean;
  error?: {
    message: string;
    name: string;
    stack?: string;
    errorHash?: string;
    code?: string;
  };
  operations: {
    dbQueries: number;
    externalCalls: number;
    redisOps: number;
  };
  operationDetails: {
    dbQueries: unknown[];
    externalCalls: unknown[];
    redisOps: unknown[];
  };
  environment: string;
  userId?: string;
  gitCommitSha?: string;
  correlationId: string;
  breadcrumbs?: Array<{ message: string; level?: string; category?: string; timestamp: string; metadata?: unknown }>;
  user?: Record<string, unknown>;
  extraOperations?: unknown[];
  tags?: Record<string, string>;
}
