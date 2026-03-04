import type { ReplaylyClient } from "../../core/client";

export function instrument(client: ReplaylyClient): void {
  try {
    const pg = require("pg");
    const originalQuery = pg.Client.prototype.query;

    pg.Client.prototype.query = function (...args: unknown[]) {
      const startTime = Date.now();
      const queryText = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string })?.text;

      const promise = originalQuery.apply(this, args);

      promise
        .then((result: { rowCount?: number }) => {
          client.captureOperation("db_query", {
            database: "postgresql",
            query: queryText,
            durationMs: Date.now() - startTime,
            rowCount: result.rowCount,
            success: true,
          });
        })
        .catch((error: Error) => {
          client.captureOperation("db_query", {
            database: "postgresql",
            query: queryText,
            durationMs: Date.now() - startTime,
            success: false,
            error: error.message,
          });
        });

      return promise;
    };
  } catch {
    // pg not installed
  }
}
