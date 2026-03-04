import "./load-env";

import { Worker, Job } from "bullmq";
import { connection } from "../../lib/queue/event-queue";
import { storeEventMetadata } from "./storage/mongodb";
import { storeEventPayload } from "./storage/minio";
import { storeEventAnalytics } from "./storage/postgres";
import { indexEventSearch } from "./storage/opensearch";
import { compressPayload } from "./utils/compression";
import { getPubSub } from "../../lib/realtime/pubsub";
import { prisma } from "../../lib/db/postgres";

export interface EventJob {
  organizationId: string;
  projectId: string;
  requestId: string;
  timestamp: string;
  durationMs: number;
  method: string;
  url: string;
  statusCode: number;
  isError: boolean;
  error?: {
    message: string;
    errorHash: string;
    stack?: string;
  };
  operations: {
    dbQueries: number;
    externalCalls: number;
    redisOps: number;
  };
  operationDetails: unknown;
  environment: string;
  userId?: string;
  gitCommitSha?: string;
  correlationId: string;
  [key: string]: unknown;
}

async function captureEventMocks(event: EventJob): Promise<void> {
  const details = event.operationDetails as
    | {
        externalCalls?: Array<Record<string, unknown>>;
        dbQueries?: Array<Record<string, unknown>>;
      }
    | undefined;

  if (!details) return;

  const eventId = event.requestId;
  const projectId = event.projectId;

  // External API mocks
  const externalCalls = details.externalCalls ?? [];
  for (const call of externalCalls) {
    try {
      const url = String(call.url ?? "");
      if (!url) continue;

      const request = {
        method: call.method,
        url,
        headers: call.headers,
        body: call.body,
      };

      const response = {
        statusCode: call.statusCode,
        headers: (call as { responseHeaders?: unknown }).responseHeaders,
        body: (call as { responseBody?: unknown }).responseBody,
      };

      // Use dynamic access to avoid Prisma type issues until migration is applied
      await (prisma as unknown as { eventMock: { create(args: unknown): Promise<unknown> } }).eventMock.create({
        data: {
          eventId,
          projectId,
          mockType: "external_api",
          identifier: url,
          request,
          response,
        },
      });
    } catch {
      // Do not fail ingestion on mock capture errors
    }
  }
}

function extractRoute(url: string): string {
  try {
    const urlObj = new URL(url, "http://localhost");
    let path = urlObj.pathname;
    path = path.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "/:id"
    );
    path = path.replace(/\/\d+/g, "/:id");
    return path;
  } catch {
    return url;
  }
}

const worker = new Worker<EventJob>(
  "events",
  async (job: Job<EventJob>) => {
    const event = job.data;

    try {
      const compressedPayload = await compressPayload(event);

      const s3Pointer = await storeEventPayload(
        event.organizationId,
        event.projectId,
        event.requestId,
        compressedPayload
      );

      await storeEventMetadata({
        organizationId: event.organizationId,
        projectId: event.projectId,
        requestId: event.requestId,
        method: event.method,
        route: extractRoute(event.url),
        url: event.url,
        statusCode: event.statusCode,
        timestamp: new Date(event.timestamp),
        durationMs: event.durationMs,
        isError: event.isError,
        errorHash: event.error?.errorHash,
        errorMessage: event.error?.message,
        environment: event.environment,
        userId: event.userId,
        gitCommitSha: event.gitCommitSha,
        correlationId: event.correlationId,
        s3Pointer,
        operations: event.operations,
      });

      await storeEventAnalytics({
        projectId: event.projectId,
        timestamp: new Date(event.timestamp),
        durationMs: event.durationMs,
        isError: event.isError,
      });

      await indexEventSearch({
        organizationId: event.organizationId,
        projectId: event.projectId,
        requestId: event.requestId,
        method: event.method,
        url: event.url,
        route: extractRoute(event.url),
        statusCode: event.statusCode,
        timestamp: event.timestamp,
        errorMessage: event.error?.message,
        errorHash: event.error?.errorHash,
        environment: event.environment,
        s3Pointer,
      });

      const pubsub = getPubSub();
      const messageType = event.isError ? "error" : "event";
      await pubsub.publish(`project:${event.projectId}`, {
        type: messageType,
        projectId: event.projectId,
        data: {
          requestId: event.requestId,
          method: event.method,
          route: extractRoute(event.url),
          url: event.url,
          statusCode: event.statusCode,
          timestamp: event.timestamp,
          durationMs: event.durationMs,
          isError: event.isError,
          error: event.error,
        },
        timestamp: event.timestamp,
      });

      // Capture mocks for external calls (best-effort, non-blocking)
      await captureEventMocks(event).catch(() => {});

      return { success: true };
    } catch (error) {
      throw error;
    }
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: connection as any,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000,
    },
  }
);

worker.on("completed", () => {});
worker.on("failed", (job, err) => {
  console.error("[Worker] Job", job?.id, "failed:", err?.message);
});
worker.on("error", (err) => {
  console.error("[Worker] Error:", err);
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
