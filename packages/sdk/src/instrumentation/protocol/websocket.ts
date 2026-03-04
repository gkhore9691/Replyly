import type { ReplaylyClient } from "../../core/client";

type WebSocketServer = {
  on(event: "connection", handler: (ws: WebSocket, request?: { url?: string; headers?: Record<string, string> }) => void): void;
};

type WebSocket = {
  on(event: string, handler: (...args: unknown[]) => void): void;
  send: (data: unknown, cb?: (err?: Error) => void) => void;
};

/**
 * Instrument a ws WebSocketServer so connection, messages, and errors are sent to Replayly.
 */
export function instrumentWebSocket(wss: WebSocketServer, client: ReplaylyClient): WebSocketServer {
  wss.on("connection", (ws: WebSocket, request?: { url?: string; headers?: Record<string, string> }) => {
    const connectionId = Math.random().toString(36).slice(2, 9);
    const req = request ?? {};

    const ctx = client.createContext({
      method: "WS",
      url: req.url ?? "/",
      headers: (req.headers ?? {}) as Record<string, unknown>,
      query: {},
      body: null,
    });
    Object.assign(ctx.metadata, { connectionId, type: "websocket_connection" });
    client.sendEvent(ctx).catch(() => {});

    ws.on("message", (data: unknown) => {
      const msgCtx = client.createContext({
        method: "WS_MESSAGE",
        url: req.url ?? "/",
        headers: {},
        query: {},
        body: typeof data === "string" ? data : String(data),
      });
      Object.assign(msgCtx.metadata, { connectionId, type: "websocket_message", direction: "incoming" });
      client.sendEvent(msgCtx).catch(() => {});
    });

    const originalSend = ws.send.bind(ws);
    (ws as Record<string, unknown>).send = function (data: unknown, cb?: (err?: Error) => void) {
      const msgCtx = client.createContext({
        method: "WS_MESSAGE",
        url: req.url ?? "/",
        headers: {},
        query: {},
        body: typeof data === "string" ? data : String(data),
      });
      Object.assign(msgCtx.metadata, { connectionId, type: "websocket_message", direction: "outgoing" });
      client.sendEvent(msgCtx).catch(() => {});
      return originalSend(data, cb);
    };

    ws.on("close", () => {
      const closeCtx = client.createContext({
        method: "WS_CLOSE",
        url: req.url ?? "/",
        headers: {},
        query: {},
        body: null,
      });
      Object.assign(closeCtx.metadata, { connectionId, type: "websocket_close" });
      client.sendEvent(closeCtx).catch(() => {});
    });

    ws.on("error", (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      const errCtx = client.createContext({
        method: "WS_ERROR",
        url: req.url ?? "/",
        headers: {},
        query: {},
        body: null,
      });
      errCtx.error = { message: err.message, stack: err.stack, name: err.name };
      Object.assign(errCtx.metadata, { connectionId, type: "websocket_error" });
      client.sendEvent(errCtx).catch(() => {});
    });
  });

  return wss;
}
