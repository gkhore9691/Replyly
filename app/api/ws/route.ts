import { NextRequest, NextResponse } from "next/server";

/**
 * WebSocket upgrade is not supported in Next.js App Router route handlers.
 * Use the standalone WebSocket server instead: run `npm run ws` and set
 * NEXT_PUBLIC_WS_URL (e.g. ws://localhost:3001). Connect with ?token=<jwt>.
 */
export async function GET(req: NextRequest) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
  return NextResponse.json(
    {
      error: "WebSocket upgrade not supported on this endpoint",
      message: "Use the standalone WS server. Set NEXT_PUBLIC_WS_URL and connect with ?token=<jwt>.",
      wsUrl,
    },
    { status: 426 }
  );
}
