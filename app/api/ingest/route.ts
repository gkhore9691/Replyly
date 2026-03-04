import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, updateApiKeyLastUsed } from "@/lib/auth/api-key";
import { eventQueue } from "@/lib/queue/event-queue";
import { rateLimiter } from "@/lib/rate-limit";
import { z } from "zod";

const EventSchema = z.object({
  projectId: z.string().optional(),
  requestId: z.string(),
  timestamp: z.string(),
  durationMs: z.number(),
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string()).optional().default({}),
  query: z.any().optional(),
  body: z.any().optional(),
  statusCode: z.number(),
  responseBody: z.any().optional(),
  isError: z.boolean(),
  error: z
    .object({
      message: z.string(),
      name: z.string(),
      stack: z.string().optional(),
      errorHash: z.string(),
    })
    .optional(),
  operations: z.object({
    dbQueries: z.number(),
    externalCalls: z.number(),
    redisOps: z.number(),
  }),
  operationDetails: z.object({
    dbQueries: z.array(z.any()),
    externalCalls: z.array(z.any()),
    redisOps: z.array(z.any()),
  }),
  environment: z.string(),
  userId: z.string().optional(),
  gitCommitSha: z.string().optional(),
  correlationId: z.string(),
  breadcrumbs: z.array(z.object({
    message: z.string(),
    level: z.string().optional(),
    category: z.string().optional(),
    timestamp: z.string(),
    metadata: z.any().optional(),
  })).optional(),
  user: z.record(z.any()).optional(),
  extraOperations: z.array(z.any()).optional(),
  tags: z.record(z.string()).optional(),
});

const BatchSchema = z.object({
  events: z.array(EventSchema).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-replayly-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key" },
        { status: 401 }
      );
    }

    const apiKeyData = await validateApiKey(apiKey);
    if (!apiKeyData) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    const rateLimitResult = await rateLimiter.check(apiKeyData.projectId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfter.toString(),
          },
        }
      );
    }

    const body = await req.json();
    const validation = BatchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { events } = validation.data;
    const jobIds: string[] = [];

    for (const event of events) {
      const enrichedEvent = {
        ...event,
        projectId: apiKeyData.projectId,
        organizationId: apiKeyData.organizationId,
      };

      const job = await eventQueue.add("process-event", enrichedEvent, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      });

      jobIds.push(job.id ?? "");
    }

    updateApiKeyLastUsed(apiKeyData.id).catch(() => {});

    return NextResponse.json({
      success: true,
      received: events.length,
      jobIds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
