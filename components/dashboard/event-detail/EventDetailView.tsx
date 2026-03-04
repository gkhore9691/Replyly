"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequestPanel } from "./request-panel";
import { ResponsePanel } from "./response-panel";
import { StackTrace } from "./stack-trace";
import { Timeline } from "./timeline";
import { Copy, RefreshCw, ChevronRight } from "lucide-react";

interface OpItem {
  type?: string;
  command?: string;
  method?: string;
  query?: string;
  url?: string;
  durationMs?: number;
  success?: boolean;
  timestamp?: number;
  collection?: string;
  table?: string;
}

interface EventDetailViewProps {
  projectId: string;
  eventId: string;
  event: {
    requestId?: string;
    method?: string;
    route?: string;
    statusCode?: number;
    durationMs?: number;
    timestamp?: string;
    gitCommitSha?: string;
    isError?: boolean;
    error?: { message?: string; name?: string; stack?: string };
    fullPayload?: {
      body?: unknown;
      headers?: unknown;
      query?: unknown;
      responseBody?: unknown;
      operationDetails?: {
        dbQueries?: unknown[];
        externalCalls?: unknown[];
        redisOps?: unknown[];
      };
    };
  };
}

function statusVariant(status: number): "success" | "destructive" | "warning" | "secondary" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 500) return "destructive";
  if (status >= 400) return "warning";
  return "secondary";
}

export function EventDetailView({ projectId, eventId, event }: EventDetailViewProps) {
  const router = useRouter();
  const ops = event.fullPayload?.operationDetails ?? {};
  const dbQueries = (ops.dbQueries ?? []) as OpItem[];
  const externalCalls = (ops.externalCalls ?? []) as OpItem[];

  const copyEventId = () => {
    if (event.requestId ?? eventId) {
      navigator.clipboard.writeText(String(event.requestId ?? eventId));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
        <Link
          href={`/dashboard/${projectId}/events`}
          className="hover:text-[var(--accent)]"
        >
          Events
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--fg)]">
          {event.method} {event.route}
        </span>
      </nav>

      {/* Title + badges + CTAs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--fg)]">
            {event.method} {event.route}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(event.statusCode ?? 0)} className="font-mono">
              {event.statusCode}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {event.method}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {event.durationMs ?? 0}ms
            </Badge>
            <Badge variant="outline" className="font-mono">
              {event.timestamp
                ? new Date(event.timestamp).toLocaleString()
                : "—"}
            </Badge>
            {event.gitCommitSha && (
              <Badge variant="outline" className="font-mono">
                {String(event.gitCommitSha).slice(0, 7)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90"
            onClick={() =>
              router.push(
                `/dashboard/${projectId}/events/${eventId}/replay`
              )
            }
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Replay This Event
          </Button>
          <Button variant="ghost" size="icon" onClick={copyEventId} title="Copy Event ID">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="request" className="w-full">
        <TabsList className="w-full justify-start border-b border-[var(--border)] bg-transparent">
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="db">DB Queries</TabsTrigger>
          <TabsTrigger value="external">External Calls</TabsTrigger>
          <TabsTrigger value="stack">Stack Trace</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="request" className="mt-4">
          <RequestPanel event={event} />
        </TabsContent>
        <TabsContent value="response" className="mt-4">
          <ResponsePanel event={event} />
        </TabsContent>
        <TabsContent value="db" className="mt-4">
          <Card>
            <CardHeader>
              <p className="font-mono text-xs text-[var(--muted)]">
                ( DB QUERIES )
              </p>
            </CardHeader>
            <CardContent>
              {dbQueries.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No database queries captured.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="pb-2 text-left font-mono text-xs text-[var(--muted)]">
                          Query
                        </th>
                        <th className="pb-2 text-left font-mono text-xs text-[var(--muted)]">
                          Collection/Table
                        </th>
                        <th className="pb-2 text-left font-mono text-xs text-[var(--muted)]">
                          Duration
                        </th>
                        <th className="pb-2 text-left font-mono text-xs text-[var(--muted)]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbQueries.map((q, i) => (
                        <tr
                          key={i}
                          className="border-b border-white/5"
                        >
                          <td className="py-2 font-mono text-xs text-[var(--fg)] max-w-md truncate">
                            {String(q.query ?? q.command ?? "—")}
                          </td>
                          <td className="py-2 font-mono text-xs text-[var(--muted)]">
                            {String(q.collection ?? q.table ?? "—")}
                          </td>
                          <td className="py-2 font-mono text-xs text-[var(--muted)]">
                            {q.durationMs != null ? `${q.durationMs}ms` : "—"}
                          </td>
                          <td className="py-2">
                            <Badge
                              variant={q.success === false ? "destructive" : "success"}
                              className="font-mono text-xs"
                            >
                              {q.success === false ? "Failed" : "OK"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="external" className="mt-4">
          <Card>
            <CardHeader>
              <p className="font-mono text-xs text-[var(--muted)]">
                ( EXTERNAL CALLS )
              </p>
            </CardHeader>
            <CardContent>
              {externalCalls.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No external HTTP calls captured.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="pb-2 text-left font-mono text-xs text-[var(--muted)]">
                          Method
                        </th>
                        <th className="pb-2 text-left font-mono text-xs text-[var(--muted)]">
                          URL
                        </th>
                        <th className="pb-2 text-left font-mono text-xs text-[var(--muted)]">
                          Status
                        </th>
                        <th className="pb-2 text-left font-mono text-xs text-[var(--muted)]">
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {externalCalls.map((op, i) => (
                        <tr
                          key={i}
                          className="border-b border-white/5"
                        >
                          <td className="py-2 font-mono text-xs text-[var(--fg)]">
                            {String(op.method ?? "—")}
                          </td>
                          <td className="py-2 font-mono text-xs text-[var(--muted)] max-w-md truncate">
                            {String(op.url ?? "—")}
                          </td>
                          <td className="py-2">
                            <Badge
                              variant={op.success === false ? "destructive" : "success"}
                              className="font-mono text-xs"
                            >
                              {op.success === false ? "Failed" : "OK"}
                            </Badge>
                          </td>
                          <td className="py-2 font-mono text-xs text-[var(--muted)]">
                            {op.durationMs != null ? `${op.durationMs}ms` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stack" className="mt-4">
          {event.error ? (
            <Card className="border-[var(--red)]/30">
              <CardHeader>
                <p className="font-mono text-xs text-[var(--muted)]">
                  ( STACK TRACE )
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-mono text-sm text-[var(--red)]">
                  {event.error.message ?? "Unknown error"}
                </p>
                {event.error.stack && (
                  <pre className="overflow-auto rounded-sm border border-[var(--border)] bg-[#050505] p-4 font-mono text-xs text-[var(--muted)] whitespace-pre-wrap">
                    {event.error.stack}
                  </pre>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-[var(--muted)]">
                No stack trace (request did not error).
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <Timeline event={event} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
