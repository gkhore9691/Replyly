import { Queue } from "bullmq";
import IORedis from "ioredis";
import { getRedisUrl } from "@/lib/db/redis";

const redisUrl = getRedisUrl();

const redisOpts: { maxRetriesPerRequest: null; retryStrategy: (times: number) => number } = {
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    return Math.min(times * 50, 2000);
  },
};

const globalForAlertRedis = globalThis as unknown as { alertRedis: IORedis };

export function getAlertRedisConnection(): IORedis {
  if (!globalForAlertRedis.alertRedis) {
    globalForAlertRedis.alertRedis = new IORedis(redisUrl, redisOpts);
  }
  return globalForAlertRedis.alertRedis;
}

const connection = getAlertRedisConnection();

export const alertEvaluationQueue = new Queue("alert-evaluation", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: connection as any,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const alertsQueue = new Queue("alerts", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
