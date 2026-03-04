"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Radio } from "lucide-react";
import { useProjectLive } from "@/components/dashboard/ProjectLiveContext";

interface DashboardOverviewProps {
  projectId: string;
}

interface Totals {
  totalEvents?: number;
  errorEvents?: number;
  errorRate?: number;
  avgDuration?: number;
}

interface DailyStat {
  date: string;
  totalEvents: number;
  errorEvents: number;
  avgDurationMs?: number;
}

interface RecentEvent {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  isError: boolean;
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-3 w-24 rounded-sm bg-white/10 animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 rounded-sm bg-white/10 animate-pulse" />
        <div className="mt-2 h-3 w-20 rounded-sm bg-white/5 animate-pulse" />
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(ts: string) {
  const d = new Date(ts);
  const now = Date.now();
  const s = Math.floor((now - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function statusVariant(status: number): "success" | "destructive" | "warning" | "secondary" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 500) return "destructive";
  if (status >= 400) return "warning";
  return "secondary";
}

export function DashboardOverview({ projectId }: DashboardOverviewProps) {
  const { liveMode, setLiveMode, isConnected, liveEvents } = useProjectLive();
  const [analytics, setAnalytics] = useState<{
    totals?: Totals;
    stats?: DailyStat[];
  } | null>(null);
  const [recentErrors, setRecentErrors] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/analytics?days=1`).then((r) => r.json()),
      fetch(
        `/api/projects/${projectId}/events?limit=10&isError=true&page=1`
      ).then((r) => r.json()),
    ])
      .then(([analyticsData, eventsData]) => {
        setAnalytics(analyticsData);
        setRecentErrors(eventsData.events ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const totals = analytics?.totals ?? {};
  const stats = analytics?.stats ?? [];
  const recentErrorsToShow = liveMode ? liveEvents : recentErrors;
  const chartData = stats.map((s) => ({
    time: new Date(s.date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    events: s.totalEvents,
    errors: s.errorEvents,
    fullDate: s.date,
  }));

  const container = {
    animate: {
      transition: { staggerChildren: 0.08 },
    },
  };

  const item = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
            ( DASHBOARD )
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
            Overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={liveMode ? "default" : "outline"}
            size="sm"
            onClick={() => setLiveMode(!liveMode)}
            className={liveMode ? "border-[var(--green)]/50 bg-[var(--green)]/10 text-[var(--green)]" : ""}
          >
            <Radio className="mr-1.5 h-3.5 w-3.5" />
            {liveMode ? "Live on" : "Live off"}
          </Button>
          {liveMode && (
            <Badge
              variant="success"
              className={isConnected ? "animate-pulse font-mono text-xs" : "font-mono text-xs opacity-70"}
            >
              {isConnected ? "Live" : "Connecting…"}
            </Badge>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={container}
        initial="initial"
        animate="animate"
      >
        {loading ? (
          [...Array(4)].map((_, i) => (
            <motion.div key={i} variants={item}>
              <StatCardSkeleton />
            </motion.div>
          ))
        ) : (
          <>
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-2">
                  <p className="font-mono text-xs text-[var(--muted)]">
                    TOTAL EVENTS
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-2xl font-bold text-[var(--fg)]">
                    {(totals.totalEvents ?? 0).toLocaleString()}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                    Last 24h
                  </p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-2">
                  <p className="font-mono text-xs text-[var(--muted)]">
                    ERROR RATE
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-2xl font-bold text-[var(--fg)]">
                    {typeof totals.errorRate === "number"
                      ? `${totals.errorRate.toFixed(1)}%`
                      : "0%"}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs">
                    {totals.errorEvents && totals.totalEvents ? (
                      (totals.errorEvents / totals.totalEvents) * 100 >
                      (totals.errorRate ?? 0) ? (
                        <span className="text-[var(--red)] flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" /> Up
                        </span>
                      ) : (
                        <span className="text-[var(--accent)] flex items-center gap-0.5">
                          <TrendingDown className="h-3 w-3" /> Down
                        </span>
                      )
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-2">
                  <p className="font-mono text-xs text-[var(--muted)]">
                    AVG DURATION
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-2xl font-bold text-[var(--fg)]">
                    {typeof totals.avgDuration === "number"
                      ? `${Math.round(totals.avgDuration)}ms`
                      : "—"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Mean response</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-2">
                  <p className="font-mono text-xs text-[var(--muted)]">
                    REPLAYS TODAY
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-2xl font-bold text-[var(--fg)]">
                    0
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Phase 5</p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Chart + Recent errors */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <p className="font-mono text-xs text-[var(--muted)]">
              ( EVENTS OVER 24H )
            </p>
          </CardHeader>
          <CardContent className="h-[280px]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-48 w-full max-w-md space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-8 rounded-sm bg-white/5 animate-pulse"
                      style={{ width: `${60 + i * 8}%` }}
                    />
                  ))}
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                No data for the last 24h
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="fillEvents"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--accent)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--accent)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <YAxis
                    hide
                    domain={[0, "auto"]}
                    tick={{ fill: "var(--muted)", fontSize: 10 }}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "var(--muted)", fontSize: 10 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="events"
                    stroke="var(--accent)"
                    strokeWidth={1.5}
                    fill="url(#fillEvents)"
                  />
                  {chartData
                    .filter((d) => d.errors > 0)
                    .map((d, i) => (
                      <ReferenceDot
                        key={i}
                        x={d.time}
                        y={d.events}
                        r={4}
                        fill="var(--red)"
                      />
                    ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <p className="font-mono text-xs text-[var(--muted)]">
              ( RECENT ERRORS )
            </p>
            <Link
              href={`/dashboard/${projectId}/events?isError=true`}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-12 rounded-sm bg-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : recentErrorsToShow.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">
                {liveMode ? "Waiting for live events…" : "No recent errors. Select a time range or view all events."}
              </p>
            ) : (
              <ul className="divide-y border-white/5">
                {recentErrorsToShow.slice(0, 10).map((ev) => (
                  <li key={ev.requestId}>
                    <Link
                      href={`/dashboard/${projectId}/events/${ev.requestId}`}
                      className="flex items-center justify-between gap-2 py-3 transition-colors hover:bg-white/[0.02]"
                    >
                      <span className="min-w-0 flex-1 font-mono text-sm">
                        <span className="text-[var(--muted)]">
                          [{ev.method}]
                        </span>{" "}
                        {ev.route}
                      </span>
                      <Badge
                        variant={statusVariant(ev.statusCode)}
                        className="shrink-0 font-mono"
                      >
                        {ev.statusCode}
                      </Badge>
                      <span className="shrink-0 font-mono text-xs text-[var(--muted)]">
                        {ev.durationMs}ms
                      </span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">
                        {formatRelativeTime(ev.timestamp)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
