"use client";

import { useEffect, useState } from "react";
import { MetricsCard } from "./metrics-card";
import { Loader2 } from "lucide-react";

interface StatsGridProps {
  projectId: string;
}

export function MetricsGrid({ projectId }: StatsGridProps) {
  const [data, setData] = useState<{
    totals?: {
      totalEvents?: number;
      errorEvents?: number;
      errorRate?: number;
      avgDuration?: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/analytics?days=7`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading metrics…</span>
      </div>
    );
  }

  const totals = data?.totals ?? {};

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricsCard
        title="Total events (7d)"
        value={totals.totalEvents ?? 0}
        description="Last 7 days"
      />
      <MetricsCard
        title="Errors"
        value={totals.errorEvents ?? 0}
        description="Error events in period"
      />
      <MetricsCard
        title="Error rate"
        value={
          typeof totals.errorRate === "number"
            ? `${totals.errorRate.toFixed(1)}%`
            : "0%"
        }
      />
      <MetricsCard
        title="Avg duration"
        value={
          typeof totals.avgDuration === "number"
            ? `${Math.round(totals.avgDuration)}ms`
            : "—"
        }
      />
    </div>
  );
}
