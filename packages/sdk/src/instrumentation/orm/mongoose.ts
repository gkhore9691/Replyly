import type { ReplaylyClient } from "../../core/client";

type MongooseSchema = {
  pre: (method: string | RegExp, fn: (this: unknown, next: (err?: Error) => void) => void) => void;
  post: (method: string | RegExp, fn: (this: Record<string, unknown>, ...args: unknown[]) => void) => void;
};

/**
 * Instrument Mongoose so that queries are recorded in the current Replayly context.
 * Call once after mongoose is loaded (e.g. before defining models).
 */
export function instrumentMongoose(client: ReplaylyClient): void {
  try {
    const mongoose = require("mongoose");
    if (typeof mongoose.plugin !== "function") return;

    mongoose.plugin(function (this: unknown, schema: MongooseSchema) {
      const opKey = "_replaylyOp";

      schema.pre(/^(find|findOne|save|updateOne|updateMany|deleteOne|deleteMany|remove)/, function (next: (err?: Error) => void) {
        const context = client.getContext();
        if (!context) return next();

        const op: Record<string, unknown> = {
          type: "mongoose",
          model: (this as { constructor?: { modelName?: string } }).constructor?.modelName ?? "Unknown",
          action: (this as { op?: string }).op ?? "unknown",
          startTime: Date.now(),
          durationMs: 0,
        };
        (this as Record<string, unknown>)[opKey] = op;
        next();
      });

      schema.post(/^(find|findOne|save|updateOne|updateMany|deleteOne|deleteMany|remove)/, function (this: Record<string, unknown>, ...args: unknown[]) {
        const op = this[opKey];
        if (op && typeof op === "object") {
          const context = client.getContext();
          if (context) {
            (op as Record<string, unknown>).durationMs = Date.now() - ((op as Record<string, number>).startTime ?? 0);
            if (!context.operationList) context.operationList = [];
            context.operationList.push(op as Record<string, unknown>);
          }
        }
        const next = args[1] as ((err?: Error) => void) | undefined;
        if (typeof next === "function") next();
      });

      schema.post(/^(find|findOne|save|updateOne|updateMany|deleteOne|deleteMany|remove)/, function (this: Record<string, unknown>, ...args: unknown[]) {
        const op = this[opKey];
        const error = args[0] as Error;
        const next = args[2] as (err?: Error) => void;
        if (op && typeof op === "object") {
          const context = client.getContext();
          if (context) {
            (op as Record<string, unknown>).durationMs = Date.now() - ((op as Record<string, number>).startTime ?? 0);
            (op as Record<string, unknown>).error = { message: error?.message, code: (error as { code?: string })?.code };
            if (!context.operationList) context.operationList = [];
            context.operationList.push(op as Record<string, unknown>);
          }
        }
        if (typeof next === "function") next(error);
      });
    });
  } catch {
    // mongoose not installed
  }
}
