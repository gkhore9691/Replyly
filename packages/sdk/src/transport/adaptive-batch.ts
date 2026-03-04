import type { CapturedEvent } from "../core/types";

export interface AdaptiveBatchConfig {
  minBatchSize: number;
  maxBatchSize: number;
  minFlushInterval: number;
  maxFlushInterval: number;
  targetLatency: number;
}

export class AdaptiveBatcher {
  private queue: CapturedEvent[] = [];
  private flushIntervalMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushTime = Date.now();
  private avgFlushDuration = 0;

  constructor(
    private config: AdaptiveBatchConfig,
    private onFlush: (events: CapturedEvent[]) => Promise<void>
  ) {
    this.flushIntervalMs = config.minFlushInterval;
    this.scheduleFlush();
  }

  add(event: CapturedEvent): void {
    this.queue.push(event);
    if (this.queue.length >= this.config.maxBatchSize) {
      this.doFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.doFlush();
    }, this.flushIntervalMs);
  }

  private doFlush(): void {
    if (this.queue.length === 0) {
      this.scheduleFlush();
      return;
    }

    const events = this.queue.splice(0, this.config.maxBatchSize);
    const flushStart = Date.now();

    this.onFlush(events)
      .then(() => {
        const duration = Date.now() - flushStart;
        this.avgFlushDuration =
          this.avgFlushDuration === 0 ? duration : this.avgFlushDuration * 0.7 + duration * 0.3;

        if (this.avgFlushDuration > this.config.targetLatency) {
          this.flushIntervalMs = Math.min(
            this.flushIntervalMs * 1.5,
            this.config.maxFlushInterval
          );
        } else if (this.avgFlushDuration < this.config.targetLatency * 0.5) {
          this.flushIntervalMs = Math.max(
            this.flushIntervalMs * 0.8,
            this.config.minFlushInterval
          );
        }

        this.lastFlushTime = Date.now();
      })
      .catch(() => {
        this.queue.unshift(...events);
      })
      .finally(() => {
        this.scheduleFlush();
      });
  }

  async shutdown(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    while (this.queue.length > 0) {
      const events = this.queue.splice(0, this.config.maxBatchSize);
      await this.onFlush(events);
    }
  }
}
