import Redis from "ioredis";
import { getRedisUrl } from "@/lib/db/redis";

export interface PubSubMessage {
  type: "event" | "error" | "alert" | "release";
  projectId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

const redisOpts: { maxRetriesPerRequest: null; retryStrategy: (times: number) => number } = {
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    return Math.min(times * 50, 2000);
  },
};

export class RedisPubSub {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers: Map<string, Set<(message: PubSubMessage) => void>> = new Map();

  constructor() {
    const url = getRedisUrl();
    this.publisher = new Redis(url, redisOpts);
    this.subscriber = new Redis(url, redisOpts);
    this.subscriber.on("message", (channel: string, message: string) => {
      const handlers = this.handlers.get(channel);
      if (handlers) {
        try {
          const parsed = JSON.parse(message) as PubSubMessage;
          handlers.forEach((handler) => handler(parsed));
        } catch {
          // ignore invalid JSON
        }
      }
    });
  }

  async connect(): Promise<void> {
    await this.publisher.ping();
    await this.subscriber.ping();
  }

  async publish(channel: string, message: PubSubMessage): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: PubSubMessage) => void): Promise<void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.handlers.get(channel)!.add(handler);
  }

  async unsubscribe(channel: string, handler: (message: PubSubMessage) => void): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        await this.subscriber.unsubscribe(channel);
        this.handlers.delete(channel);
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

let pubsubInstance: RedisPubSub | null = null;

export function getPubSub(): RedisPubSub {
  if (!pubsubInstance) {
    pubsubInstance = new RedisPubSub();
  }
  return pubsubInstance;
}
