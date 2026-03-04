import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";
import type { ReplaylyConfig, RequestContext, CapturedEvent } from "./types";
import { Transport } from "./transport";
import { Masker } from "../masking/masker";
import { CustomOperations } from "../api/custom-operations";
import { Breadcrumbs } from "../api/breadcrumbs";
import { UserContextManager } from "../api/user-context";

export class ReplaylyClient {
  private config: ReplaylyConfig;
  private transport: Transport;
  private masker: Masker;
  private asyncLocalStorage: AsyncLocalStorage<RequestContext>;
  public readonly customOperations: CustomOperations;
  public readonly breadcrumbs: Breadcrumbs;
  public readonly userContext: UserContextManager;

  constructor(config: ReplaylyConfig) {
    this.config = this.validateConfig(config);
    this.transport = new Transport(this.config);
    this.masker = new Masker(this.config.maskFields ?? []);
    this.asyncLocalStorage = new AsyncLocalStorage<RequestContext>();
    this.customOperations = new CustomOperations(this);
    this.breadcrumbs = new Breadcrumbs(this);
    this.userContext = new UserContextManager(this);
    this.initializeInstrumentation();
  }

  async trackOperation<T>(name: string, fn: () => Promise<T>, metadata?: unknown): Promise<T> {
    return this.customOperations.trackOperation(name, fn, metadata);
  }

  addBreadcrumb(message: string, options?: { level?: "debug" | "info" | "warning" | "error"; category?: string; metadata?: unknown }): void {
    this.breadcrumbs.add(message, options);
  }

  setUser(user: { id: string; email?: string; name?: string; username?: string; [key: string]: unknown }): void {
    this.userContext.setUser(user);
  }

  private validateConfig(config: ReplaylyConfig): ReplaylyConfig {
    if (!config.apiKey) {
      throw new Error("Replayly: apiKey is required");
    }
    return {
      ...config,
      endpoint: config.endpoint ?? "https://api.replayly.dev/ingest",
      environment: config.environment ?? process.env.NODE_ENV ?? "production",
      maxPayloadSize: config.maxPayloadSize ?? 200 * 1024,
      sampleRate: config.sampleRate ?? 1.0,
      captureBody: config.captureBody !== false,
      captureHeaders: config.captureHeaders !== false,
    };
  }

  private initializeInstrumentation(): void {
    if (this.config.captureAxios !== false) {
      try {
        require("../instrumentation/external/axios").instrument(this);
      } catch {
        // axios not installed
      }
    }
    if (this.config.captureFetch !== false) {
      try {
        require("../instrumentation/external/fetch").instrument(this);
      } catch {
        // optional
      }
    }
    if (this.config.captureMongo !== false) {
      try {
        require("../instrumentation/database/mongodb").instrument(this);
      } catch {
        // mongodb not installed
      }
    }
    if (this.config.capturePostgres !== false) {
      try {
        require("../instrumentation/database/postgres").instrument(this);
      } catch {
        // pg not installed
      }
    }
    if (this.config.captureRedis !== false) {
      try {
        require("../instrumentation/cache/redis").instrument(this);
      } catch {
        // ioredis not installed
      }
    }
  }

  public createContext(req: { method?: string; url?: string; headers?: Record<string, unknown>; query?: unknown; body?: unknown; user?: { id?: string } }): RequestContext {
    const headers = (req.headers && typeof req.headers === "object")
      ? this.masker.maskHeaders(req.headers as Record<string, unknown>)
      : {};
    return {
      requestId: this.generateRequestId(),
      startTime: Date.now(),
      method: req.method ?? "GET",
      url: req.url ?? "",
      headers,
      query: req.query,
      body: this.captureRequestBody(req),
      operations: {
        dbQueries: [],
        externalCalls: [],
        redisOps: [],
      },
      metadata: {
        userId: req.user?.id,
        gitCommitSha: process.env.GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
        environment: this.config.environment ?? "production",
      },
    };
  }

  public runInContext<T>(context: RequestContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  public getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  public captureOperation(type: string, data: Record<string, unknown>): void {
    const context = this.getContext();
    if (!context) return;
    const operation = { type, timestamp: Date.now(), durationMs: 0, ...data };
    switch (type) {
      case "db_query":
        context.operations.dbQueries.push(operation);
        break;
      case "external_call":
        context.operations.externalCalls.push(operation);
        break;
      case "redis_op":
        context.operations.redisOps.push(operation);
        break;
    }
  }

  public async captureResponse(res: { statusCode?: number; _replaylyBody?: unknown } | number, error?: Error): Promise<void> {
    const context = this.getContext();
    if (!context) return;
    if (Math.random() > (this.config.sampleRate ?? 1)) return;

    const statusCode = typeof res === "object" && res !== null && "statusCode" in res ? (res as { statusCode: number }).statusCode : (typeof res === "number" ? res : 200);
    const responseBody = typeof res === "object" && res !== null && "_replaylyBody" in res ? (res as { _replaylyBody?: unknown })._replaylyBody : undefined;

    const event = this.buildEventFromContext(context, statusCode, responseBody, error);
    const maskedEvent = this.masker.maskEvent(event) as CapturedEvent;
    this.transport.send(maskedEvent).catch(() => {});
  }

  /** Build a CapturedEvent from a RequestContext (for sendEvent / framework integrations). */
  public buildEventFromContext(
    context: RequestContext,
    statusCode?: number,
    responseBody?: unknown,
    error?: Error
  ): CapturedEvent {
    const code = statusCode ?? context.response?.statusCode ?? (error ? 500 : 200);
    const body = responseBody ?? context.response?.body;
    const err = error
      ? this.captureError(error)
      : context.error
        ? {
            message: context.error.message,
            name: context.error.name ?? "Error",
            stack: context.error.stack,
            errorHash: this.generateErrorHash({ message: context.error.message, stack: context.error.stack } as Error),
          }
        : undefined;
    const durationMs = context.durationMs ?? Date.now() - context.startTime;

    return {
      projectId: this.config.projectId,
      requestId: context.requestId,
      timestamp: new Date(context.startTime).toISOString(),
      durationMs,
      method: context.method,
      url: context.url,
      headers: context.headers,
      query: context.query,
      body: context.body,
      statusCode: code,
      responseBody: body,
      isError: !!err || code >= 400,
      error: err,
      operations: {
        dbQueries: context.operations.dbQueries.length,
        externalCalls: context.operations.externalCalls.length,
        redisOps: context.operations.redisOps.length,
      },
      operationDetails: {
        dbQueries: [...context.operations.dbQueries],
        externalCalls: [...context.operations.externalCalls],
        redisOps: [...context.operations.redisOps],
      },
      environment: context.metadata.environment,
      userId: context.metadata.userId ?? context.user?.id,
      gitCommitSha: context.metadata.gitCommitSha,
      correlationId: context.requestId,
      breadcrumbs: context.breadcrumbs?.map((b) => ({
        message: b.message,
        level: b.level,
        category: b.category,
        timestamp: (b.timestamp instanceof Date ? b.timestamp : new Date()).toISOString(),
        metadata: b.metadata,
      })),
      user: context.user,
      extraOperations: context.operationList?.length ? [...context.operationList] : undefined,
      tags: context.tags,
    };
  }

  /** Send an event from a context (used by framework plugins). */
  public async sendEvent(context: RequestContext): Promise<void> {
    if (Math.random() > (this.config.sampleRate ?? 1)) return;
    const event = this.buildEventFromContext(context);
    const maskedEvent = this.masker.maskEvent(event) as CapturedEvent;
    await this.transport.send(maskedEvent);
  }

  /** Initialize client (no-op; for API compatibility with framework plugins). */
  public async init(): Promise<void> {}

  /** Flush pending events to the server. */
  public async flush(): Promise<void> {
    await this.transport.flush();
  }

  private captureError(error: Error): { message: string; name: string; stack?: string; errorHash: string } {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      errorHash: this.generateErrorHash(error),
    };
  }

  private generateErrorHash(error: Error): string {
    const normalized = (error.stack ?? "")
      .split("\n")
      .map((line) => line.replace(/:\d+:\d+/g, ""))
      .join("\n");
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  private captureRequestBody(req: { body?: unknown }): unknown {
    if (this.config.captureBody === false) return undefined;
    const body = req.body;
    if (body === undefined || body === null) return undefined;
    try {
      const size = JSON.stringify(body).length;
      if (size > (this.config.maxPayloadSize ?? 200 * 1024)) {
        return { _truncated: true, _size: size };
      }
    } catch {
      return undefined;
    }
    return body;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  public async shutdown(): Promise<void> {
    await this.transport.shutdown();
  }
}
