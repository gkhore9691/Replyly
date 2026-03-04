import { redis } from "@/lib/db/redis";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_IP = 100;

/**
 * Rate limit by IP. Use for unauthenticated or auth endpoints to prevent abuse.
 * Returns true if the request is allowed, false if over limit.
 */
export async function rateLimitByIP(ip: string): Promise<boolean> {
  const key = `rate_limit:ip:${ip}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  return count <= MAX_REQUESTS_PER_IP;
}

const USER_WINDOW_SECONDS = 3600;
const MAX_REQUESTS_PER_USER = 10000;

/**
 * Rate limit by user ID. Use for authenticated API routes.
 */
export async function rateLimitByUser(userId: string): Promise<boolean> {
  const key = `rate_limit:user:${userId}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, USER_WINDOW_SECONDS);
  }

  return count <= MAX_REQUESTS_PER_USER;
}
