"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface WebSocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

export interface UseWebSocketOptions {
  projectId: string;
  filters?: {
    eventTypes?: string[];
    routes?: string[];
    statusCodes?: number[];
    errorOnly?: boolean;
  };
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  enabled?: boolean;
}

const WS_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001") : "";

const MAX_RECONNECT_INTERVAL = 30000; // cap at 30s
const INITIAL_RECONNECT_INTERVAL = 3000;

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    projectId,
    filters,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnect = true,
    reconnectInterval = INITIAL_RECONNECT_INTERVAL,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);
  const reconnectAttemptRef = useRef(0);

  const optsRef = useRef(options);
  optsRef.current = options;

  const connect = useCallback(() => {
    if (!enabled || !projectId || !WS_BASE) return;

    const connectWithToken = async () => {
      const { onMessage: om, onConnect: oc, onDisconnect: od, onError: oe } = optsRef.current;
      let token: string;
      try {
        const res = await fetch("/api/ws-token", { credentials: "include" });
        if (!res.ok) {
          oe?.(new Event("auth_failed"));
          return;
        }
        const data = (await res.json()) as { token: string };
        token = data.token;
      } catch {
        oe?.(new Event("fetch_failed"));
        return;
      }

      const url = `${WS_BASE}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
        oc?.();
        ws.send(
          JSON.stringify({
            type: "subscribe",
            payload: { projectId, filters: optsRef.current.filters },
          })
        );
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const message = JSON.parse(event.data as string) as WebSocketMessage;
          setLastMessage(message);
          optsRef.current.onMessage?.(message);
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;
        od?.();
        if (reconnect && enabled && mountedRef.current) {
          const attempt = reconnectAttemptRef.current;
          reconnectAttemptRef.current += 1;
          const delay = Math.min(
            reconnectInterval * Math.pow(1.5, attempt),
            MAX_RECONNECT_INTERVAL
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWithToken();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        optsRef.current.onError?.(error);
      };
    };

    connectWithToken();
  }, [enabled, projectId, reconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled && projectId) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, projectId, connect, disconnect]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    isConnected,
    lastMessage,
    send,
    disconnect,
    reconnect: connect,
  };
}
