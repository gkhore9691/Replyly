"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface HistoryItem {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredAt: string;
  condition: string;
  value: number;
  threshold: number;
  notificationsSent: number;
  notificationsFailed: number;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

interface AlertHistoryListProps {
  projectId: string;
}

export function AlertHistoryList({ projectId }: AlertHistoryListProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/alerts/history?limit=50`)
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-sm bg-white/10 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-sm bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-[var(--muted)] tracking-wider">( ALERT HISTORY )</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">Alert History</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Recent alert triggers</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/${projectId}/settings/alerts`}>Back to rules</Link>
        </Button>
      </div>

      <Card className="border-[var(--border)]">
        <CardHeader className="border-b border-[var(--border)]">
          <div className="grid grid-cols-5 gap-4 font-mono text-xs text-[var(--muted)]">
            <span>Rule</span>
            <span>Triggered</span>
            <span>Condition</span>
            <span>Value / Threshold</span>
            <span>Notifications</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--muted)]">
              No alert history yet
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="grid grid-cols-5 gap-4 px-6 py-3 text-sm hover:bg-white/[0.02]"
                >
                  <span className="font-medium text-[var(--fg)]">{h.ruleName}</span>
                  <span className="text-[var(--muted)]">
                    {new Date(h.triggeredAt).toLocaleString()}
                  </span>
                  <span className="font-mono text-xs">{h.condition}</span>
                  <span className="font-mono text-xs">
                    {h.value.toFixed(2)} / {h.threshold}
                  </span>
                  <span className="text-[var(--muted)]">
                    {h.notificationsSent} sent{h.notificationsFailed > 0 ? `, ${h.notificationsFailed} failed` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
