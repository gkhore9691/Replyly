import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ReplaylyClient } from "@replayly/sdk";
import type { ReplaylyConfig } from "@replayly/sdk";

export interface ReplaylyNextConfig extends ReplaylyConfig {
  ignoreRoutes?: string[];
  captureSearchParams?: boolean;
}

let client: ReplaylyClient | null = null;

export function getReplaylyClient(): ReplaylyClient | null {
  return client;
}

export function createReplaylyMiddleware(config: ReplaylyNextConfig) {
  if (!client) {
    client = new ReplaylyClient(config);
    void client.init();
  }

  return async function replaylyMiddleware(request: NextRequest): Promise<NextResponse> {
    const path = request.nextUrl.pathname;
    if (config.ignoreRoutes?.some((route) => path.startsWith(route))) {
      return NextResponse.next();
    }

    const context = client!.createContext({
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      query:
        config.captureSearchParams !== false
          ? Object.fromEntries(request.nextUrl.searchParams.entries())
          : {},
      body: null,
    });

    const response = NextResponse.next();
    response.headers.set("x-replayly-request-id", context.requestId);
    return response;
  };
}
