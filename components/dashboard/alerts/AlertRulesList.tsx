"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2 } from "lucide-react";

interface AlertChannel {
  id: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  conditions: unknown[];
  channels: AlertChannel[];
  throttleMinutes: number;
  createdAt: string;
}

interface AlertRulesListProps {
  projectId: string;
}

export function AlertRulesList({ projectId }: AlertRulesListProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, [projectId]);

  async function fetchRules() {
    try {
      const res = await fetch(`/api/projects/${projectId}/alerts`);
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(ruleId: string, enabled: boolean) {
    try {
      await fetch(`/api/projects/${projectId}/alerts/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      fetchRules();
    } catch {
      // revert on error
      fetchRules();
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("Are you sure you want to delete this alert rule?")) return;
    try {
      await fetch(`/api/projects/${projectId}/alerts/${ruleId}`, {
        method: "DELETE",
      });
      fetchRules();
    } catch {
      fetchRules();
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-sm bg-white/10 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-sm bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
            ( ALERT RULES )
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
            Alert Rules
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Configure alerts to be notified of issues
          </p>
        </div>
        <Link href={`/dashboard/${projectId}/settings/alerts/new`}>
          <Button className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            New Alert Rule
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <Card key={rule.id} className="p-6 border-[var(--border)]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-[var(--fg)]">{rule.name}</h3>
                  <Badge
                    variant={rule.enabled ? "success" : "secondary"}
                    className="font-mono text-xs"
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                {rule.description && (
                  <p className="text-sm text-[var(--muted)] mb-3">{rule.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
                  <span>{Array.isArray(rule.conditions) ? rule.conditions.length : 0} condition(s)</span>
                  <span>{rule.channels?.length ?? 0} channel(s)</span>
                  <span>Throttle: {rule.throttleMinutes}m</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                />
                <Link href={`/dashboard/${projectId}/settings/alerts/${rule.id}/edit`}>
                  <Button variant="ghost" size="icon">
                    <Edit className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteRule(rule.id)}
                  className="text-[var(--red)] hover:text-[var(--red)] hover:bg-[var(--red)]/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {rules.length === 0 && (
          <Card className="p-12 text-center border-[var(--border)]">
            <p className="text-[var(--muted)] mb-4">No alert rules configured</p>
            <Link href={`/dashboard/${projectId}/settings/alerts/new`}>
              <Button className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
                Create your first alert rule
              </Button>
            </Link>
          </Card>
        )}
      </div>

      <div>
        <Link
          href={`/dashboard/${projectId}/settings/alerts/history`}
          className="text-sm text-[var(--accent)] hover:underline"
        >
          View alert history
        </Link>
      </div>
    </div>
  );
}
