import type { NextRequest, NextResponse } from "next/server";
import type { ReplaylyClient } from "@replayly/sdk";

export function withReplayly(
  handler: (req: NextRequest) => Promise<NextResponse>,
  client: ReplaylyClient | null
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    if (!client) return handler(req);

    const context = client.createContext({
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
      body: null,
    });

    try {
      const response = await client.runInContext(context, () => handler(req));

      context.response = {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: null,
      };
      try {
        const cloned = response.clone();
        context.response.body = await cloned.json().catch(() => null);
      } catch {
        // ignore
      }
      context.durationMs = Date.now() - context.startTime;
      await client.sendEvent(context);

      return response;
    } catch (error: unknown) {
      context.error = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : "Error",
      };
      context.durationMs = Date.now() - context.startTime;
      await client.sendEvent(context);
      throw error;
    }
  };
}
