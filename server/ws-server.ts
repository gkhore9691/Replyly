/**
 * Standalone WebSocket server for real-time event streaming.
 * Next.js App Router does not support WebSocket upgrade in route handlers;
 * run this server alongside the app (e.g. npm run ws).
 * Set NEXT_PUBLIC_WS_URL to the WS URL (e.g. ws://localhost:3001).
 */
import "./load-env";

import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { verifyToken } from "../lib/auth/jwt";
import { verifyProjectAccess } from "../lib/auth/project-access";
import { SubscriptionManager, type Subscription } from "../lib/realtime/subscriptions";
import { randomUUID } from "crypto";

const PORT = parseInt(process.env.WS_PORT || "3001", 10);

interface AuthPayload {
  userId: string;
}

function getTokenFromUrl(url: string): string | null {
  try {
    const u = new URL(url, "http://localhost");
    return u.searchParams.get("token");
  } catch {
    return null;
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: WebSocket, req) => {
  const url = req.url || "";
  const token = getTokenFromUrl(url);
  let auth: AuthPayload | null = null;

  try {
    if (!token) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Missing token" } }));
      ws.close();
      return;
    }
    const payload = verifyToken(token);
    auth = { userId: payload.userId };
  } catch {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid token" } }));
    ws.close();
    return;
  }

  const connectionId = randomUUID();
  const subscriptionManager = new SubscriptionManager();

  ws.send(
    JSON.stringify({
      type: "connected",
      payload: { connectionId },
    })
  );

  ws.on("message", async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as { type: string; payload?: Record<string, unknown> };
      const { type, payload: msgPayload } = message;

      if (type === "subscribe") {
        const projectId = msgPayload?.projectId as string | undefined;
        const filters = msgPayload?.filters as Subscription["filters"] | undefined;

        if (!projectId) {
          ws.send(JSON.stringify({ type: "error", payload: { message: "projectId required" } }));
          return;
        }

        const hasAccess = await verifyProjectAccess(auth!.userId, projectId);
        if (!hasAccess) {
          ws.send(JSON.stringify({ type: "error", payload: { message: "Access denied to project" } }));
          return;
        }

        await subscriptionManager.subscribe({
          id: connectionId,
          projectId,
          userId: auth!.userId,
          filters,
          callback: (event) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "event", payload: event }));
            }
          },
        });

        ws.send(
          JSON.stringify({
            type: "subscribed",
            payload: { projectId, subscriptionId: connectionId },
          })
        );
      } else if (type === "unsubscribe") {
        await subscriptionManager.unsubscribe(connectionId);
        ws.send(JSON.stringify({ type: "unsubscribed", payload: { subscriptionId: connectionId } }));
      } else if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message format" } }));
    }
  });

  ws.on("close", async () => {
    await subscriptionManager.unsubscribe(connectionId);
  });

  ws.on("error", () => {
    subscriptionManager.unsubscribe(connectionId);
  });
});

wss.on("listening", () => {
  console.log(`[WS] Server listening on port ${PORT}`);
});
