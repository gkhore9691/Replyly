import axios, { AxiosResponse } from "axios";
import { RequestBuilder } from "./request-builder";
import { Tracer } from "./tracer";

interface ReplayConfig {
  host: string;
  port: number;
  https: boolean;
}

export interface ReplayResult {
  statusCode: number;
  durationMs: number;
  operations?: {
    dbQueries: number;
    externalCalls: number;
    redisOps: number;
  };
  trace?: Array<{ timestamp: string; event: string; data?: unknown }>;
  differences?: string[];
  response?: unknown;
}

interface ReplayEvent {
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  fullPayload?: Record<string, unknown>;
  operations?: { dbQueries: number; externalCalls: number; redisOps: number };
}

export class ReplayEngine {
  private config: ReplayConfig;
  private tracer: Tracer;

  constructor(config: ReplayConfig) {
    this.config = config;
    this.tracer = new Tracer();
  }

  async replay(event: ReplayEvent): Promise<ReplayResult> {
    const startTime = Date.now();

    const requestBuilder = new RequestBuilder(event);
    const request = requestBuilder.build();

    const protocol = this.config.https ? "https" : "http";
    const url = `${protocol}://${this.config.host}:${this.config.port}${request.path}`;

    this.tracer.log("request_start", { url, method: request.method });

    try {
      const response = await axios({
        method: request.method,
        url,
        headers: request.headers,
        params: request.query,
        data: request.body,
        validateStatus: () => true,
        maxRedirects: 0,
      });

      const durationMs = Date.now() - startTime;

      this.tracer.log("request_complete", {
        statusCode: response.status,
        durationMs,
      });

      const differences = this.compareResults(event, response, durationMs);

      return {
        statusCode: response.status,
        durationMs,
        trace: this.tracer.getTrace(),
        differences,
        response: response.data,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.tracer.log("request_error", { error: err.message });
      throw new Error(`Replay failed: ${err.message}`);
    }
  }

  private compareResults(
    original: ReplayEvent,
    response: AxiosResponse,
    durationMs: number
  ): string[] {
    const differences: string[] = [];
    const origStatus = original.statusCode ?? 0;
    const origDuration = original.durationMs ?? 0;

    if (response.status !== origStatus) {
      differences.push(
        `Status code mismatch: got ${response.status}, expected ${origStatus}`
      );
    }

    if (origDuration > 0) {
      const durationDiff = Math.abs(durationMs - origDuration);
      const durationVariance = durationDiff / origDuration;

      if (durationVariance > 0.5) {
        differences.push(
          `Duration variance: ${Math.round(durationVariance * 100)}% (${durationMs}ms vs ${origDuration}ms)`
        );
      }
    }

    return differences;
  }
}
