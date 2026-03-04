"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { EventCard } from "./event-card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export interface EventListItem {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  timestamp: string;
  durationMs: number;
  isError: boolean;
  errorMessage?: string;
}

interface EventListProps {
  projectId: string;
  filters: Record<string, string | string[] | undefined>;
}

export function EventList({ projectId, filters }: EventListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pageFromUrl = typeof filters.page === "string" ? parseInt(filters.page, 10) : 1;
  const page = Number.isFinite(pageFromUrl) && pageFromUrl >= 1 ? pageFromUrl : 1;

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const loadMore = () => {
    const next = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") next.set(k, Array.isArray(v) ? v[0] : v);
    });
    next.set("page", String(page + 1));
    router.push(`${pathname ?? ""}?${next.toString()}`);
  };

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "50",
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === "") return;
      if (Array.isArray(value)) params.set(key, value[0]);
      else params.set(key, value);
    });

    const res = await fetch(`/api/projects/${projectId}/events?${params}`);
    const data = await res.json();

    if (data.error) {
      setEvents([]);
      setPagination({ page: 1, limit: 50, total: 0, pages: 0 });
      setHasMore(false);
      setLoading(false);
      return;
    }

    const newEvents = data.events ?? [];
    setEvents((prev) => (page === 1 ? newEvents : [...prev, ...newEvents]));
    setPagination(data.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 });
    setHasMore(
      (data.pagination?.page ?? 1) < (data.pagination?.pages ?? 0)
    );
    setLoading(false);
  }, [projectId, filters, page]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No events found. Send requests with the Replayly SDK to see them here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventCard
          key={event.requestId}
          event={event}
          projectId={projectId}
        />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
