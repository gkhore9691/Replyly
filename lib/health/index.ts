import { mongodb } from "@/lib/db/mongodb";
import { redis } from "@/lib/db/redis";
import { prisma } from "@/lib/db/postgres";
import { getQueueMetrics } from "@/lib/queue/metrics";

export interface ServiceCheck {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface HealthChecks {
  postgres: ServiceCheck;
  mongodb: ServiceCheck;
  redis: ServiceCheck;
  queue: ServiceCheck & { metrics?: Awaited<ReturnType<typeof getQueueMetrics>> };
}

export async function checkAllServices(): Promise<HealthChecks> {
  const checks: HealthChecks = {
    postgres: { healthy: false },
    mongodb: { healthy: false },
    redis: { healthy: false },
    queue: { healthy: false },
  };

  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = { healthy: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.postgres = {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const t0 = Date.now();
    const db = await mongodb.getDb();
    await db.admin().ping();
    checks.mongodb = { healthy: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.mongodb = {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const t0 = Date.now();
    await redis.ping();
    checks.redis = { healthy: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.redis = {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const metrics = await getQueueMetrics();
    checks.queue = {
      healthy: true,
      metrics,
    };
  } catch (err) {
    checks.queue = {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return checks;
}
