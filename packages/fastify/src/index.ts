import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { ReplaylyClient } from "@replayly/sdk";
import type { ReplaylyConfig } from "@replayly/sdk";

export interface ReplaylyFastifyOptions extends ReplaylyConfig {
  captureHeaders?: boolean;
  captureQuery?: boolean;
  captureBody?: boolean;
  captureResponse?: boolean;
  ignoreRoutes?: string[];
}

declare module "fastify" {
  interface FastifyInstance {
    replayly: ReplaylyClient;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    replaylyContext?: ReturnType<ReplaylyClient["createContext"]>;
  }
}

const replaylyPlugin: FastifyPluginAsync<ReplaylyFastifyOptions> = async (fastify, options) => {
  const client = new ReplaylyClient(options);
  await client.init();

  const ignoreRoutes = options.ignoreRoutes ?? [];

  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (ignoreRoutes.some((route) => path.startsWith(route))) {
      return;
    }

    const context = client.createContext({
      method: request.method,
      url: request.url,
      headers: options.captureHeaders !== false ? (request.headers as Record<string, unknown>) : {},
      query: options.captureQuery !== false ? (request.query as Record<string, unknown>) : {},
      body: options.captureBody !== false ? (request.body as unknown) ?? null : null,
    });

    request.replaylyContext = context;
  });

  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const context = request.replaylyContext;
    if (!context) return;

    context.response = {
      statusCode: reply.statusCode,
      headers: reply.getHeaders() as Record<string, string>,
    };
    context.durationMs = Date.now() - context.startTime;

    await client.sendEvent(context);
  });

  fastify.addHook("onError", async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const context = request.replaylyContext;
    if (!context) return;

    context.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
    context.durationMs = Date.now() - context.startTime;

    await client.sendEvent(context);
  });

  fastify.decorate("replayly", client);

  fastify.addHook("onClose", async () => {
    await client.flush();
  });
};

export default fp(replaylyPlugin, {
  fastify: "4.x",
  name: "replayly-fastify",
});
