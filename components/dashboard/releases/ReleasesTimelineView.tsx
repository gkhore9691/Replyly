"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GitBranch, Loader2, AlertTriangle, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";

const ERROR_SPIKE_THRESHOLD = 10;

interface Release {
  id: string;
  version: string;
  commitSha: string;
  branch: string | null;
  author: string | null;
  deployedAt: string;
  environment: string;
  stats: { errorCount: number; totalCount: number; errorRate: number };
}

export function ReleasesTimelineView({
  projectId,
  ReleaseList,
}: {
  projectId: string;
  ReleaseList: React.ComponentType<{
    releases: Release[];
    projectId: string;
  }>;
}) {
  const [integration, setIntegration] = useState<{
    connected: boolean;
    integration?: { id: string; githubUsername: string } | null;
  } | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [intRes, relRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/integrations/github`),
          fetch(`/api/projects/${projectId}/releases`),
        ]);
        if (cancelled) return;
        const intData = await intRes.json();
        const relData = await relRes.json();
        setIntegration(
          intData.error ? null : { connected: intData.connected, integration: intData.integration }
        );
        setReleases(relData.error ? [] : relData.releases ?? []);
      } catch {
        if (!cancelled) setReleases([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 2
          ? [prev[1], id]
          : [...prev, id]
    );
  };

  const compareReleases = compareIds
    .map((id) => releases.find((r) => r.id === id))
    .filter(Boolean) as Release[];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 w-full max-w-md rounded-sm bg-white/5 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!integration?.connected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <GitBranch className="h-12 w-12 text-[var(--muted)] mb-4" />
          <p className="font-mono text-xs text-[var(--muted)] mb-2">
            ( CONNECT GITHUB )
          </p>
          <p className="text-sm text-[var(--muted)] mb-4 text-center max-w-md">
            Connect your repository to track releases and correlate errors with
            deployments.
          </p>
          <Button asChild className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
            <Link href={`/api/auth/github?projectId=${projectId}`}>
              Connect GitHub
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-[var(--muted)]">
          Compare two releases
        </p>
        {compareIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCompareIds([])}
          >
            Clear compare
          </Button>
        )}
      </div>

      {compareReleases.length === 2 && (
        <Card>
          <CardHeader>
            <p className="font-mono text-xs text-[var(--muted)]">
              ( COMPARE )
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {compareReleases.map((r) => (
                <div
                  key={r.id}
                  className="rounded-sm border border-[var(--border)] p-4"
                >
                  <p className="font-heading font-semibold text-[var(--fg)]">
                    {r.version || r.commitSha.slice(0, 7)}
                  </p>
                  <p className="font-mono text-xs text-[var(--muted)] mt-1">
                    {r.commitSha.slice(0, 7)} · {new Date(r.deployedAt).toLocaleString()}
                  </p>
                  <div className="mt-3 flex gap-4 font-mono text-sm">
                    <span>Errors: {r.stats.errorCount}</span>
                    <span>Total: {r.stats.totalCount}</span>
                    <span className={r.stats.errorRate > ERROR_SPIKE_THRESHOLD ? "text-[var(--red)]" : "text-[var(--muted)]"}>
                      Rate: {r.stats.errorRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ReleasesTimeline releases={releases} projectId={projectId} onToggleCompare={toggleCompare} compareIds={compareIds} />
      <ReleaseList releases={releases} projectId={projectId} />
    </div>
  );
}

function ReleasesTimeline({
  releases,
  projectId,
  onToggleCompare,
  compareIds,
}: {
  releases: Release[];
  projectId: string;
  onToggleCompare: (id: string) => void;
  compareIds: string[];
}) {
  if (releases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--muted)]">
          No releases yet. Configure the webhook to track deployments.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs text-[var(--muted)]">
          ( RELEASES )
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[var(--border)]" />
          <div className="space-y-0">
            {releases.slice(0, 20).map((release) => {
              const hasSpike = release.stats.errorRate > ERROR_SPIKE_THRESHOLD;
              const sparkData = [
                { v: Math.min(100, release.stats.errorRate) },
                { v: Math.min(100, release.stats.errorRate * 0.8) },
                { v: Math.min(100, release.stats.errorRate * 1.1) },
                { v: release.stats.errorRate },
              ];
              const initials = release.author
                ? release.author.slice(0, 2).toUpperCase()
                : "??";

              return (
                <div
                  key={release.id}
                  className="relative flex items-start gap-4 py-4"
                >
                  <div
                    className={cn(
                      "relative z-10 flex h-6 w-6 shrink-0 rounded-full border-2",
                      hasSpike
                        ? "border-[var(--red)] bg-[var(--red)]/10"
                        : "border-[var(--green)]/50 bg-[var(--green)]/10"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-[var(--fg)]">
                        {release.version || release.commitSha.slice(0, 7)}
                      </span>
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {release.commitSha.slice(0, 7)}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(release.deployedAt).toLocaleString()}
                      </span>
                      <Avatar className="h-6 w-6 border border-[var(--border)]">
                        <AvatarFallback className="bg-[#111] text-[10px] font-mono text-[var(--muted)]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-6 w-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={sparkData}>
                            <defs>
                              <linearGradient id={`spark-${release.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--muted)" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="var(--muted)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="v"
                              stroke="var(--muted)"
                              strokeWidth={1}
                              fill={`url(#spark-${release.id})`}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      {hasSpike && (
                        <Badge variant="destructive" className="font-mono text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          ERROR SPIKE DETECTED
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 text-xs",
                          compareIds.includes(release.id) && "text-[var(--accent)]"
                        )}
                        onClick={() => onToggleCompare(release.id)}
                      >
                        <GitCompare className="mr-1 h-3 w-3" />
                        Compare
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
