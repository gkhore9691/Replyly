import type { ReplaylyClient } from "../core/client";

export interface CustomOperation {
  type: string;
  name: string;
  startTime: number;
  durationMs: number;
  metadata?: unknown;
  error?: { message: string; stack?: string };
}

export class CustomOperations {
  constructor(private client: ReplaylyClient) {}

  async trackOperation<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: unknown
  ): Promise<T> {
    const context = this.client.getContext();
    if (!context) return fn();

    const operation: CustomOperation = {
      type: "custom",
      name,
      startTime: Date.now(),
      durationMs: 0,
      metadata,
    };

    if (!context.operationList) context.operationList = [];
    try {
      const result = await fn();
      operation.durationMs = Date.now() - operation.startTime;
      context.operationList.push(operation as unknown as Record<string, unknown>);
      return result;
    } catch (err: unknown) {
      operation.durationMs = Date.now() - operation.startTime;
      operation.error = {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
      context.operationList.push(operation as unknown as Record<string, unknown>);
      throw err;
    }
  }

  startOperation(name: string, metadata?: unknown): (error?: Error) => void {
    const context = this.client.getContext();
    if (!context) return () => {};

    const operation: CustomOperation = {
      type: "custom",
      name,
      startTime: Date.now(),
      durationMs: 0,
      metadata,
    };

    if (!context.operationList) context.operationList = [];

    return (error?: Error) => {
      operation.durationMs = Date.now() - operation.startTime;
      if (error) {
        operation.error = {
          message: error.message,
          stack: error.stack,
        };
      }
      context.operationList!.push(operation as unknown as Record<string, unknown>);
    };
  }

  addMetadata(key: string, value: unknown): void {
    const context = this.client.getContext();
    if (context) {
      context.metadata[key] = value;
    }
  }

  addTags(tags: Record<string, string>): void {
    const context = this.client.getContext();
    if (context) {
      context.tags = { ...context.tags, ...tags };
    }
  }
}
