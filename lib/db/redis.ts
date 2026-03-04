import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export function getRedisConnection(): { host: string; port: number; maxRetriesPerRequest: null; retryStrategy: (times: number) => number } {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
      return Math.min(times * 50, 2000);
    },
  };
}

export function getRedisUrl(): string {
  return redisUrl;
}
