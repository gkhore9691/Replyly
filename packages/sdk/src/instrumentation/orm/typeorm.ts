import type { ReplaylyClient } from "../../core/client";

/**
 * Create a TypeORM-compatible logger that records queries in the current Replayly context.
 * Use with DataSource: new DataSource({ ...options, logger: createReplaylyTypeOrmLogger(client) })
 */
export function createReplaylyTypeOrmLogger(client: ReplaylyClient): {
  logQuery?(query: string, parameters?: unknown[]): void;
  logQueryError?(error: string, query: string, parameters?: unknown[]): void;
} {
  return {
    logQuery(query: string, parameters?: unknown[]) {
      const context = client.getContext();
      if (!context) return;
      if (!context.operationList) context.operationList = [];
      context.operationList.push({
        type: "typeorm",
        query,
        parameters,
        startTime: Date.now(),
        durationMs: 0,
      });
    },
    logQueryError(error: string, query: string, parameters?: unknown[]) {
      const context = client.getContext();
      if (!context) return;
      if (!context.operationList) context.operationList = [];
      context.operationList.push({
        type: "typeorm",
        query,
        parameters,
        error: { message: error },
        startTime: Date.now(),
        durationMs: 0,
      });
    },
  };
}

/**
 * Instrument TypeORM DataSource by attaching Replayly logger to options.
 */
export function instrumentTypeORM(
  dataSource: { options?: Record<string, unknown> },
  client: ReplaylyClient
): typeof dataSource {
  try {
    if (dataSource.options) {
      dataSource.options.logger = createReplaylyTypeOrmLogger(client);
    }
    return dataSource;
  } catch {
    return dataSource;
  }
}
