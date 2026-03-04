import type { CapturedEvent, ReplaylyConfig } from "./types";

export class Transport {
  private config: ReplaylyConfig;
  private queue: CapturedEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private maxQueueSize: number;
  private flushIntervalMs: number;

  constructor(config: ReplaylyConfig) {
    this.config = config;
    this.maxQueueSize = config.maxQueueSize ?? 100;
    this.flushIntervalMs = config.flushInterval ?? 5000;
    this.startFlushInterval();
  }

  async send(event: CapturedEvent): Promise<void> {
    this.queue.push(event);
    if (this.queue.length >= this.maxQueueSize) {
      await this.flush();
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush().catch(() => {
          // Error already logged in flush
        });
      }
    }, this.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0, this.maxQueueSize);
    const endpoint = this.config.endpoint ?? "https://api.replayly.dev/ingest";
    const body = JSON.stringify({ events });

    try {
      const url = new URL(endpoint);
      const options: import("https").RequestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Replayly-API-Key": this.config.apiKey,
          "Content-Length": Buffer.byteLength(body, "utf-8"),
        },
      };

      await new Promise<void>((resolve, reject) => {
        const protocol = url.protocol === "https:" ? require("https") : require("http");
        const req = protocol.request(options, (res: import("http").IncomingMessage) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk; });
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });
        req.on("error", reject);
        req.setTimeout(5000, () => {
          req.destroy(new Error("timeout"));
        });
        req.write(body);
        req.end();
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.isRetryable(err)) {
        this.queue.unshift(...events);
      }
    }
  }

  private isRetryable(err: unknown): boolean {
    if (err && typeof err === "object" && "message" in err) {
      const msg = String((err as { message: string }).message);
      if (msg.startsWith("HTTP 5")) return true;
      if (msg === "timeout" || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) return true;
    }
    return false;
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }
}
