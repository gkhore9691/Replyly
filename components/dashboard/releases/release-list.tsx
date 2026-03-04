"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCommit } from "lucide-react";

interface ReleaseStats {
  errorCount: number;
  totalCount: number;
  errorRate: number;
}

interface Release {
  id: string;
  version: string;
  commitSha: string;
  branch: string | null;
  author: string | null;
  deployedAt: string;
  environment: string;
  stats: ReleaseStats;
}

export function ReleaseList({
  releases,
  projectId,
}: {
  releases: Release[];
  projectId: string;
}) {
  if (releases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--muted)]">
          No releases yet. Connect GitHub and configure the webhook to track
          deployments.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-xs text-[var(--muted)]">( ALL RELEASES )</p>
      <div className="space-y-0 divide-y divide-white/5">
        {releases.map((release) => (
          <Link
            key={release.id}
            href={`/dashboard/${projectId}/releases/${release.id}`}
            className="block transition-colors hover:bg-white/[0.02]"
          >
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <GitCommit className="h-5 w-5 shrink-0 text-[var(--muted)]" />
                <div className="min-w-0">
                  <p className="font-mono font-medium text-[var(--fg)] truncate">
                    {release.version || release.commitSha.slice(0, 7)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(release.deployedAt).toLocaleString()}
                    {release.author && ` · ${release.author}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="font-mono text-xs">
                  {release.environment}
                </Badge>
                {release.stats.errorCount > 0 && (
                  <Badge variant="destructive" className="font-mono text-xs">
                    {release.stats.errorCount} errors
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="text-[var(--muted)]">
                  View
                </Button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
