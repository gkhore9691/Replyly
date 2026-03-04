jest.mock("@/lib/db/redis", () => {
  const store: Record<string, { count: number; expiry: number }> = {};
  return {
    redis: {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(store[key]?.count ?? 0);
      }),
      zrange: jest.fn().mockImplementation((key: string, _a: number, _b: number, _with: string) => {
        const s = store[key];
        if (!s || s.count === 0) return Promise.resolve([]);
        return Promise.resolve(["member", String(Date.now() - 30000)]);
      }),
      zadd: jest.fn().mockImplementation((key: string, _score: number, _member: string) => {
        store[key] = store[key] ?? { count: 0, expiry: 0 };
        store[key].count += 1;
        return Promise.resolve(1);
      }),
      expire: jest.fn().mockResolvedValue("OK"),
    },
    __resetStore: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
});

import { rateLimiter } from "@/lib/rate-limit";

const redis = require("@/lib/db/redis").redis;

describe("rateLimiter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redis.zcard.mockResolvedValue(0);
    redis.zrange.mockResolvedValue([]);
  });

  it("should allow first request", async () => {
    redis.zcard.mockResolvedValue(0);

    const result = await rateLimiter.check("project_1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.retryAfter).toBe(0);
  });

  it("should allow requests under limit", async () => {
    redis.zcard.mockResolvedValue(10);

    const result = await rateLimiter.check("project_1");

    expect(result.allowed).toBe(true);
  });

  it("should block when at or over limit", async () => {
    redis.zcard.mockResolvedValue(1000);
    redis.zrange.mockResolvedValue(["member", String(Date.now() - 1000)]);

    const result = await rateLimiter.check("project_1");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThanOrEqual(0);
  });
});
