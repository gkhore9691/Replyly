import { redis } from "@/lib/db/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

class RateLimiter {
  private defaultLimit = 1000;
  private windowMs = 60 * 1000;

  async check(projectId: string): Promise<RateLimitResult> {
    const key = `rate_limit:${projectId}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);

    if (count >= this.defaultLimit) {
      const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestTimestamp =
        oldest.length >= 2 ? parseInt(String(oldest[1]), 10) : now;
      const retryAfter = Math.ceil(
        (oldestTimestamp + this.windowMs - now) / 1000
      );
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    await redis.zadd(key, now, `${now}:${Math.random()}`);
    await redis.expire(key, Math.ceil(this.windowMs / 1000));

    return {
      allowed: true,
      remaining: this.defaultLimit - count - 1,
      retryAfter: 0,
    };
  }
}

export const rateLimiter = new RateLimiter();
