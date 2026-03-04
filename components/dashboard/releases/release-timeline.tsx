"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle } from "lucide-react";

interface ReleaseStats {
  errorCount: number;
  totalCount: number;
  errorRate: number;
}

interface Release {
  id: string;
  version: string;
  deployedAt: string;
  stats: ReleaseStats;
}

export function ReleaseTimeline({ releases }: { releases: Release[] }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-6">
            {releases.slice(0, 10).map((release) => (
              <div
                key={release.id}
                className="relative flex items-start gap-4"
              >
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    release.stats.errorRate > 10
                      ? "border-destructive bg-destructive/10"
                      : "border-green-500 bg-green-500/10"
                  }`}
                >
                  {release.stats.errorRate > 10 ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{release.version}</span>
                    {release.stats.errorRate > 10 && (
                      <Badge variant="destructive">
                        {release.stats.errorCount} errors
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(release.deployedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
