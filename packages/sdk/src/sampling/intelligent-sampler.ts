import type { RequestContext } from "../core/types";

export interface SamplingConfig {
  defaultRate: number;
  errorRate: number;
  slowRequestThreshold: number;
  slowRequestRate: number;
  routes?: Record<string, number>;
}

export class IntelligentSampler {
  constructor(private config: SamplingConfig) {}

  shouldSample(context: RequestContext & { durationMs?: number; response?: { statusCode?: number }; error?: unknown }): boolean {
    if (context.error || (context.response?.statusCode && context.response.statusCode >= 400)) {
      return Math.random() < this.config.errorRate;
    }

    const duration = context.durationMs ?? (Date.now() - context.startTime);
    if (duration >= this.config.slowRequestThreshold) {
      return Math.random() < this.config.slowRequestRate;
    }

    if (this.config.routes && context.url) {
      for (const [pattern, rate] of Object.entries(this.config.routes)) {
        if (context.url.includes(pattern)) {
          return Math.random() < rate;
        }
      }
    }

    return Math.random() < this.config.defaultRate;
  }
}
