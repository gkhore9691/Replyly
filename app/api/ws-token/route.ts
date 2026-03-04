import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth/session";

/**
 * Returns the current session token for use with the standalone WebSocket server.
 * The client should call this (with credentials) and pass the token to the WS URL: ?token=...
 */
export async function GET(req: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
