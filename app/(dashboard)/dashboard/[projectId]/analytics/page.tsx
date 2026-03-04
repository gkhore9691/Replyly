"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MetricsCard } from "@/components/dashboard/analytics/metrics-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface DailyStat {
  date: string;
  totalEvents: number;
  errorEvents: number;
  avgDurationMs: number;
}

export default function AnalyticsPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  interface Totals {
    totalEvents?: number;
    errorEvents?: number;
    errorRate?: number;
    avgDuration?: number;
  }
  const [data, setData] = useState<{
    stats?: DailyStat[];
    totals?: Totals;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/analytics?days=${days}`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [projectId, days]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totals: Totals = data?.totals ?? {};
  const stats = data?.stats ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Performance and error metrics over time
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                days === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Total events"
          value={totals.totalEvents ?? 0}
          description={`Last ${days} days`}
        />
        <MetricsCard
          title="Errors"
          value={totals.errorEvents ?? 0}
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

      <Card>
        <CardHeader>
          <CardTitle>Daily breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No daily stats yet. Events will appear here once processed.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-right py-2 font-medium">Events</th>
                    <th className="text-right py-2 font-medium">Errors</th>
                    <th className="text-right py-2 font-medium">Avg (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((row) => (
                    <tr key={row.date} className="border-b">
                      <td className="py-2">
                        {new Date(row.date).toLocaleDateString()}
                      </td>
                      <td className="text-right py-2">{row.totalEvents}</td>
                      <td className="text-right py-2">{row.errorEvents}</td>
                      <td className="text-right py-2">
                        {Math.round(row.avgDurationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
