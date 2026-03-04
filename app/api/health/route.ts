import { NextResponse } from "next/server";
import { mongodb } from "@/lib/db/mongodb";
import { redis } from "@/lib/db/redis";
import { prisma } from "@/lib/db/postgres";
import { getQueueMetrics } from "@/lib/queue/metrics";

export async function GET() {
  const checks: {
    postgres: boolean;
    mongodb: boolean;
    redis: boolean;
    queue: Awaited<ReturnType<typeof getQueueMetrics>> | null;
  } = {
    postgres: false,
    mongodb: false,
    redis: false,
    queue: null,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = true;
  } catch {
    // ignore
  }

  try {
    const db = await mongodb.getDb();
    await db.admin().ping();
    checks.mongodb = true;
  } catch {
    // ignore
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch {
    // ignore
  }

  try {
    checks.queue = await getQueueMetrics();
  } catch {
    // ignore
  }

  const healthy = checks.postgres && checks.mongodb && checks.redis;

  return NextResponse.json(
    { healthy, checks },
    { status: healthy ? 200 : 503 }
  );
}
