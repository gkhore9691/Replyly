"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { toast } from "@/components/ui/use-toast";

const STORAGE_KEY = "replayly-live";

export interface RecentEvent {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  isError: boolean;
}

interface ProjectLiveContextValue {
  liveMode: boolean;
  setLiveMode: (on: boolean) => void;
  isConnected: boolean;
  liveEvents: RecentEvent[];
}

const ProjectLiveContext = createContext<ProjectLiveContextValue | null>(null);

function getStoredLive(projectId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}-${projectId}`);
    return raw === "true";
  } catch {
    return false;
  }
}

function setStoredLive(projectId: string, on: boolean) {
  try {
    sessionStorage.setItem(`${STORAGE_KEY}-${projectId}`, on ? "true" : "false");
  } catch {
    // ignore
  }
}

export function ProjectLiveProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [liveMode, setLiveModeState] = useState(() => getStoredLive(projectId));
  const [liveEvents, setLiveEvents] = useState<RecentEvent[]>([]);

  useEffect(() => {
    setLiveModeState(getStoredLive(projectId));
    setLiveEvents([]);
  }, [projectId]);

  const setLiveMode = useCallback(
    (on: boolean) => {
      setLiveModeState(on);
      setStoredLive(projectId, on);
      if (!on) setLiveEvents([]);
    },
    [projectId]
  );

  const handleMessage = useCallback(
    (message: { type: string; payload?: Record<string, unknown> }) => {
      if (message.type !== "event" || !message.payload) return;
      const data = message.payload.data as Record<string, unknown> | undefined;
      if (!data) return;
      const newEvent: RecentEvent = {
        requestId: (data.requestId as string) ?? "",
        method: (data.method as string) ?? "",
        route: (data.route as string) ?? "",
        statusCode: (data.statusCode as number) ?? 0,
        timestamp: (data.timestamp as string) ?? new Date().toISOString(),
        durationMs: (data.durationMs as number) ?? 0,
        isError: (data.isError as boolean) ?? (data.statusCode as number) >= 400,
      };
      setLiveEvents((prev) => {
        if (prev.some((e) => e.requestId === newEvent.requestId)) return prev;
        return [newEvent, ...prev].slice(0, 50);
      });
      if (newEvent.isError) {
        toast({
          title: "New error detected",
          description: `${newEvent.route} – ${newEvent.statusCode}`,
          variant: "destructive",
        });
      }
    },
    []
  );

  const { isConnected } = useWebSocket({
    projectId,
    enabled: liveMode,
    filters: liveMode ? undefined : { errorOnly: true },
    onMessage: handleMessage,
    onConnect: () => {
      toast({
        title: "Live mode active",
        description: "Receiving real-time events",
      });
    },
    onDisconnect: () => {
      if (liveMode) {
        toast({
          title: "Live mode disconnected",
          description: "Reconnecting…",
          variant: "destructive",
        });
      }
    },
    reconnect: liveMode,
  });

  const value: ProjectLiveContextValue = {
    liveMode,
    setLiveMode,
    isConnected: liveMode ? isConnected : false,
    liveEvents,
  };

  return (
    <ProjectLiveContext.Provider value={value}>
      {children}
    </ProjectLiveContext.Provider>
  );
}

export function useProjectLive(): ProjectLiveContextValue {
  const ctx = useContext(ProjectLiveContext);
  if (!ctx) {
    return {
      liveMode: false,
      setLiveMode: () => {},
      isConnected: false,
      liveEvents: [],
    };
  }
  return ctx;
}
