import type { ReplaylyClient } from "../../core/client";
import type { RequestContext } from "../../core/types";

interface MongoCommandMeta {
  command: string;
  collection: string;
  startTime: number;
}

interface ContextWithMongo extends RequestContext {
  _mongoCommands?: Record<string, MongoCommandMeta>;
}

export function instrument(client: ReplaylyClient): void {
  try {
    const mongodb = require("mongodb");
    const originalConnect = mongodb.MongoClient.prototype.connect;

    mongodb.MongoClient.prototype.connect = async function (...args: unknown[]) {
      const mongoClient = await originalConnect.apply(this, args);

      mongoClient.on("commandStarted", (event: { requestId: number; commandName: string; command: Record<string, string> }) => {
        const context = client.getContext() as ContextWithMongo | undefined;
        if (!context) return;
        context._mongoCommands = context._mongoCommands ?? {};
        const cmdKey = event.requestId;
        const commandName = event.commandName;
        const collection = event.command?.[commandName] ?? "";
        context._mongoCommands[String(cmdKey)] = { command: commandName, collection: String(collection), startTime: Date.now() };
      });

      mongoClient.on("commandSucceeded", (event: { requestId: number }) => {
        const context = client.getContext() as ContextWithMongo | undefined;
        if (!context?._mongoCommands) return;
        const key = String(event.requestId);
        const data = context._mongoCommands[key];
        if (!data) return;
        client.captureOperation("db_query", {
          database: "mongodb",
          command: data.command,
          collection: data.collection,
          durationMs: Date.now() - data.startTime,
          success: true,
        });
        delete context._mongoCommands[key];
      });

      mongoClient.on("commandFailed", (event: { requestId: number; failure?: { message?: string } }) => {
        const context = client.getContext() as ContextWithMongo | undefined;
        if (!context?._mongoCommands) return;
        const key = String(event.requestId);
        const data = context._mongoCommands[key];
        if (!data) return;
        client.captureOperation("db_query", {
          database: "mongodb",
          command: data.command,
          collection: data.collection,
          durationMs: Date.now() - data.startTime,
          success: false,
          error: event.failure?.message,
        });
        delete context._mongoCommands[key];
      });

      return mongoClient;
    };
  } catch {
    // mongodb not installed
  }
}
