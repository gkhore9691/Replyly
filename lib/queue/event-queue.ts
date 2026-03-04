import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

connection.on("error", (err) => {
  console.error("[Queue] Redis connection error:", err);
});

// Use type assertion: BullMQ bundles its own ioredis types; our connection is compatible at runtime
export const eventQueue = new Queue("events", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600,
    },
  },
});

eventQueue.on("error", (error) => {
  console.error("[Queue] Error:", error);
});

export { connection };
