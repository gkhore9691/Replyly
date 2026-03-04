"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { useProjectLive } from "@/components/dashboard/ProjectLiveContext";

export interface EventListItem {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  timestamp: string;
  durationMs: number;
  isError?: boolean;
}

interface EventsListPageProps {
  projectId: string;
  filters: Record<string, string | string[] | undefined>;
}

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const STATUS_GROUPS = [
  { label: "2xx", value: "2xx", min: 200, max: 299 },
  { label: "4xx", value: "4xx", min: 400, max: 499 },
  { label: "5xx", value: "5xx", min: 500, max: 599 },
];

function methodColor(m: string) {
  switch (m) {
    case "GET":
      return "bg-[var(--green)]/10 text-[var(--green)] border-[var(--green)]/50";
    case "POST":
      return "bg-blue-500/10 text-blue-400 border-blue-500/50";
    case "PUT":
      return "bg-orange-500/10 text-orange-400 border-orange-500/50";
    case "DELETE":
      return "bg-[var(--red)]/10 text-[var(--red)] border-[var(--red)]/50";
    default:
      return "bg-white/5 text-[var(--muted)] border-[var(--border)]";
  }
}

function statusVariant(status: number): "success" | "destructive" | "warning" | "secondary" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 500) return "destructive";
  if (status >= 400) return "warning";
  return "secondary";
}

function durationColor(ms: number) {
  if (ms < 100) return "text-[var(--green)]";
  if (ms < 500) return "text-[var(--yellow)]";
  return "text-[var(--red)]";
}

function truncateId(id: string) {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function EventsListPage({ projectId, filters }: EventsListPageProps) {
  const { liveMode, isConnected, liveEvents } = useProjectLive();
  const router = useRouter();
  const pathname = usePathname();
  const page = Math.max(
    1,
    parseInt(Array.isArray(filters.page) ? filters.page[0] : filters.page ?? "1", 10) || 1
  );
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [methodFilter, setMethodFilter] = useState<string | null>(
    typeof filters.method === "string" ? filters.method : null
  );
  const [statusFilter, setStatusFilter] = useState<string | null>(
    typeof filters.status === "string" ? filters.status : null
  );
  const [search, setSearch] = useState(
    typeof filters.search === "string" ? filters.search : ""
  );
  const [searchInput, setSearchInput] = useState(
    typeof filters.search === "string" ? filters.search : ""
  );

  const buildParams = useCallback(
    (overrides: {
      page?: string;
      method?: string | null;
      status?: string | null;
      search?: string;
      startDate?: string;
      endDate?: string;
    } = {}) => {
      const p = new URLSearchParams();
      const m = overrides.method !== undefined ? overrides.method : methodFilter;
      const s = overrides.status !== undefined ? overrides.status : statusFilter;
      const q = overrides.search !== undefined ? overrides.search : search;
      const start =
        overrides.startDate !== undefined
          ? overrides.startDate
          : typeof filters.startDate === "string"
            ? filters.startDate
            : "";
      const end =
        overrides.endDate !== undefined
          ? overrides.endDate
          : typeof filters.endDate === "string"
            ? filters.endDate
            : "";
      p.set("page", overrides.page ?? String(page));
      p.set("limit", "50");
      if (m) p.set("method", m);
      if (s) {
        const g = STATUS_GROUPS.find((x) => x.value === s);
        if (g) {
          p.set("statusCodeMin", String(g.min));
          p.set("statusCodeMax", String(g.max));
        }
      }
      if (q) p.set("search", q);
      if (start) p.set("startDate", start);
      if (end) p.set("endDate", end);
      return p.toString();
    },
    [page, methodFilter, statusFilter, search, filters.startDate, filters.endDate]
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const query = buildParams();
    const res = await fetch(`/api/projects/${projectId}/events?${query}`);
    const data = await res.json();
    if (data.error) {
      setEvents([]);
      setPagination({ page: 1, limit: 50, total: 0, pages: 0 });
    } else {
      setEvents(data.events ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 });
    }
    setLoading(false);
  }, [projectId, buildParams]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const applySearch = () => {
    setSearch(searchInput);
    router.push(`${pathname}?${buildParams({ page: "1", search: searchInput })}`);
  };

  const setMethod = (m: string | null) => {
    setMethodFilter(m);
    router.push(`${pathname}?${buildParams({ method: m, status: statusFilter, page: "1" })}`);
  };

  const setStatus = (s: string | null) => {
    setStatusFilter(s);
    router.push(`${pathname}?${buildParams({ status: s, method: methodFilter, page: "1" })}`);
  };

  const totalPages = pagination.pages || 1;

  const hasFilters = search || typeof filters.startDate === "string" || typeof filters.endDate === "string";
  const showLiveMerge = liveMode && page === 1 && !hasFilters;
  const eventIdsFromApi = useMemo(() => new Set(events.map((e) => e.requestId)), [events]);
  const liveToPrepend = useMemo(() => {
    if (!showLiveMerge) return [];
    const seen = new Set<string>();
    return liveEvents
      .filter((le) => !eventIdsFromApi.has(le.requestId) && !seen.has(le.requestId) && (seen.add(le.requestId), true))
      .map((le) => ({
        requestId: le.requestId,
        method: le.method,
        route: le.route,
        statusCode: le.statusCode,
        timestamp: le.timestamp,
        durationMs: le.durationMs,
        isError: le.isError,
      }));
  }, [showLiveMerge, liveEvents, eventIdsFromApi]);
  const eventsToShow = useMemo(() => {
    if (!showLiveMerge) return events;
    const seen = new Set<string>();
    const result: EventListItem[] = [];
    for (const ev of [...liveToPrepend, ...events]) {
      if (seen.has(ev.requestId)) continue;
      seen.add(ev.requestId);
      result.push(ev);
    }
    return result;
  }, [showLiveMerge, liveToPrepend, events]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
            ( EVENTS )
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
            Captured requests
          </h1>
        </div>
        {liveMode && (
          <Badge
            variant="success"
            className={isConnected ? "animate-pulse font-mono text-xs" : "font-mono text-xs opacity-70"}
          >
            {isConnected ? "Live" : "Connecting…"}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-4 border-b border-[var(--border)] pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-[var(--muted)]">Method</span>
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(methodFilter === m ? null : m)}
                className={cn(
                  "rounded-sm border px-2 py-1 font-mono text-xs transition-colors",
                  methodFilter === m
                    ? methodColor(m)
                    : "border-[var(--border)] bg-transparent text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--fg)]"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-[var(--muted)]">Status</span>
            {STATUS_GROUPS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(statusFilter === s.value ? null : s.value)}
                className={cn(
                  "rounded-sm border px-2 py-1 font-mono text-xs transition-colors",
                  statusFilter === s.value
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] bg-transparent text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--fg)]"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by route, error, user ID..."
              className="max-w-xs font-mono"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
            <Button variant="outline" size="sm" onClick={applySearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <DateRangePicker
              startDate={typeof filters.startDate === "string" ? filters.startDate : ""}
              endDate={typeof filters.endDate === "string" ? filters.endDate : ""}
              onRangeChange={(start, end) => {
                router.push(
                  `${pathname}?${buildParams({ startDate: start, endDate: end, page: "1" })}`
                );
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && eventsToShow.length === 0 ? (
            <div className="space-y-0">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-white/5 px-6 py-4"
                >
                  <div className="h-4 w-24 rounded-sm bg-white/10 animate-pulse" />
                  <div className="h-4 w-16 rounded-sm bg-white/10 animate-pulse" />
                  <div className="h-4 flex-1 rounded-sm bg-white/5 animate-pulse" />
                  <div className="h-4 w-12 rounded-sm bg-white/10 animate-pulse" />
                  <div className="h-4 w-14 rounded-sm bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          ) : eventsToShow.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--muted)]">
              No events found. Send requests with the Replayly SDK to see them
              here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-[var(--muted)]">
                      #ID
                    </th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-[var(--muted)]">
                      METHOD
                    </th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-[var(--muted)]">
                      ROUTE
                    </th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-[var(--muted)]">
                      STATUS
                    </th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-[var(--muted)]">
                      DURATION
                    </th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-[var(--muted)]">
                      TIMESTAMP
                    </th>
                    <th className="px-6 py-3 text-right font-mono text-xs font-medium text-[var(--muted)]">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {eventsToShow.map((ev) => (
                    <motion.tr
                      key={ev.requestId}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                      whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}
                    >
                      <td className="px-6 py-3 font-mono text-xs text-[var(--muted)]">
                        {truncateId(ev.requestId)}
                      </td>
                      <td className="px-6 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono text-xs",
                            methodColor(ev.method)
                          )}
                        >
                          {ev.method}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 font-mono text-sm text-[var(--fg)]">
                        {ev.route}
                      </td>
                      <td className="px-6 py-3">
                        <Badge
                          variant={statusVariant(ev.statusCode)}
                          className="font-mono"
                        >
                          {ev.statusCode}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "px-6 py-3 font-mono text-sm",
                          durationColor(ev.durationMs ?? 0)
                        )}
                      >
                        {ev.durationMs != null ? `${ev.durationMs}ms` : "—"}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-[var(--muted)]">
                        {ev.timestamp
                          ? new Date(ev.timestamp).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"
                            asChild
                          >
                            <Link
                              href={`/dashboard/${projectId}/events/${ev.requestId}/replay`}
                            >
                              <RefreshCw className="mr-1 h-3.5 w-3.5" />
                              Replay
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link
                              href={`/dashboard/${projectId}/events/${ev.requestId}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  router.push(`${pathname}?${buildParams({ page: String(page - 1) })}`)
                }
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev
              </Button>
              <span className="font-mono text-xs text-[var(--muted)]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() =>
                  router.push(`${pathname}?${buildParams({ page: String(page + 1) })}`)
                }
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

