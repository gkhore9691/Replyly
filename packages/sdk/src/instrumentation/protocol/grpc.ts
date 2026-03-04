import type { ReplaylyClient } from "../../core/client";

/**
 * Create a gRPC interceptor that records calls in Replayly.
 * Use with @grpc/grpc-js: the exact API depends on your gRPC version.
 * This returns an interceptor function that creates a context and sends the event on status.
 */
export function createGRPCInterceptor(client: ReplaylyClient): (options: unknown, nextCall: (options: unknown) => unknown) => unknown {
  try {
    const grpc = require("@grpc/grpc-js");
    return function (options: unknown, nextCall: (opts: unknown) => unknown) {
      const opts = options as Record<string, unknown> & { method_definition?: { path?: string; service_name?: string; method_name?: string } };
      const next = nextCall(options) as { start: (metadata: unknown, listener: unknown, next: (meta: unknown, listener: unknown) => void) => void };
      const methodDef = opts.method_definition ?? {};
      const path = methodDef.path ?? "unknown";
      const startTime = Date.now();

      return {
        start(metadata: unknown, listener: unknown, nextFn: (meta: unknown, list: unknown) => void) {
          const context = client.createContext({
            method: "GRPC",
            url: path,
            headers: {},
            query: {},
            body: null,
          });
          const meta = context.metadata as Record<string, unknown>;
          meta.type = "grpc_call";
          meta.service = methodDef.service_name;
          meta.method = methodDef.method_name;

          const newListener = {
            onReceiveMetadata(m: unknown, n: (m: unknown) => void) {
              n(m);
            },
            onReceiveMessage(message: unknown, n: (m: unknown) => void) {
              context.response = { body: message };
              n(message);
            },
            onReceiveStatus(status: { code: number; details: string }, n: (s: unknown) => void) {
              context.durationMs = Date.now() - startTime;
              if (context.response) context.response.statusCode = status.code;
              if (status.code !== grpc.status.OK) {
                context.error = { message: status.details, name: "GRPC", code: String(status.code) };
              }
              client.sendEvent(context).catch(() => {});
              n(status);
            },
          };

          nextFn(metadata, newListener);
        },
      };
    };
  } catch {
    return function (_options: unknown, nextCall: (opts: unknown) => unknown) {
      return nextCall(_options);
    };
  }
}
