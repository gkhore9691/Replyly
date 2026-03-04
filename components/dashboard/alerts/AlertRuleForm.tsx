"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONDITION_TYPES = [
  { value: "error_rate", label: "Error rate %" },
  { value: "response_time", label: "Response time (ms)" },
  { value: "status_code", label: "Status code count" },
  { value: "spike", label: "Error spike (x)" },
] as const;

const OPERATORS = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
] as const;

const CHANNEL_TYPES = [
  { value: "email", label: "Email" },
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
  { value: "pagerduty", label: "PagerDuty" },
  { value: "webhook", label: "Webhook" },
] as const;

interface AlertRuleFormProps {
  projectId: string;
  ruleId?: string;
}

export function AlertRuleForm({ projectId, ruleId }: AlertRuleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!ruleId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [conditionType, setConditionType] = useState<string>("error_rate");
  const [operator, setOperator] = useState<string>("gte");
  const [threshold, setThreshold] = useState("");
  const [timeWindow, setTimeWindow] = useState("5");
  const [throttleMinutes, setThrottleMinutes] = useState("5");
  const [channelType, setChannelType] = useState<string>("email");
  const [channelConfig, setChannelConfig] = useState("");

  useEffect(() => {
    if (ruleId) {
      fetch(`/api/projects/${projectId}/alerts`)
        .then((r) => r.json())
        .then((data) => {
          const rule = (data.rules ?? []).find((r: { id: string }) => r.id === ruleId);
          if (rule) {
            setName(rule.name);
            setDescription(rule.description ?? "");
            setThrottleMinutes(String(rule.throttleMinutes ?? 5));
            const cond = (Array.isArray(rule.conditions) ? rule.conditions[0] : undefined) as Record<string, unknown> | undefined;
            if (cond) {
              setConditionType(String(cond.type ?? "error_rate"));
              setOperator(String(cond.operator ?? "gte"));
              setThreshold(String(cond.threshold ?? ""));
              setTimeWindow(String(cond.timeWindow ?? 5));
            }
            const ch = (rule.channels && rule.channels[0]) as { type: string; config: Record<string, unknown> } | undefined;
            if (ch) {
              setChannelType(ch.type ?? "email");
              setChannelConfig(JSON.stringify(ch.config ?? {}, null, 2));
            }
          }
        })
        .finally(() => setLoading(false));
    }
  }, [projectId, ruleId]);

  function buildConfig(): Record<string, unknown> {
    try {
      return JSON.parse(channelConfig || "{}");
    } catch {
      if (channelType === "email") return { recipients: [] };
      if (channelType === "slack" || channelType === "discord") return { webhookUrl: "" };
      if (channelType === "pagerduty") return { integrationKey: "" };
      if (channelType === "webhook") return { url: "" };
      return {};
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const th = parseFloat(threshold);
    const tw = parseInt(timeWindow, 10);
    const throttle = parseInt(throttleMinutes, 10);
    if (Number.isNaN(th) || Number.isNaN(tw) || Number.isNaN(throttle)) return;

    const conditions = [
      {
        type: conditionType,
        operator,
        threshold: th,
        timeWindow: tw,
        ...(conditionType === "response_time" && { aggregation: "avg" }),
      },
    ];

    const config = buildConfig();
    if (channelType === "email" && !(config.recipients as string[])?.length) {
      (config as Record<string, unknown>).recipients = [""];
    }

    const channels = [{ type: channelType, config }];

    setSaving(true);
    try {
      if (ruleId) {
        const res = await fetch(`/api/projects/${projectId}/alerts/${ruleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || undefined,
            conditions,
            throttleMinutes: throttle,
          }),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        const res = await fetch(`/api/projects/${projectId}/alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || undefined,
            conditions,
            channels,
            throttleMinutes: throttle,
          }),
        });
        if (!res.ok) throw new Error("Failed to create");
      }
      router.push(`/dashboard/${projectId}/settings/alerts`);
      router.refresh();
    } catch {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6 border-[var(--border)]">
        <div className="h-64 flex items-center justify-center text-[var(--muted)]">Loading...</div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 border-[var(--border)] space-y-6">
        <div className="grid gap-4">
          <div>
            <Label htmlFor="name" className="text-[var(--fg)]">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High error rate"
              required
              className="mt-1 border-[var(--border)] bg-transparent"
            />
          </div>
          <div>
            <Label htmlFor="description" className="text-[var(--fg)]">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When to trigger this alert"
              className="mt-1 border-[var(--border)] bg-transparent"
            />
          </div>
        </div>

        <CardHeader className="p-0 font-mono text-xs text-[var(--muted)]">CONDITION</CardHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-[var(--fg)]">Type</Label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value)}
              className="mt-1 w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
            >
              {CONDITION_TYPES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[var(--fg)]">Operator</Label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="mt-1 w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
            >
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="threshold" className="text-[var(--fg)]">Threshold</Label>
            <Input
              id="threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={conditionType === "error_rate" ? "5" : "1000"}
              required
              className="mt-1 border-[var(--border)] bg-transparent"
            />
          </div>
          <div>
            <Label htmlFor="timeWindow" className="text-[var(--fg)]">Time window (min)</Label>
            <Input
              id="timeWindow"
              type="number"
              min={1}
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              required
              className="mt-1 border-[var(--border)] bg-transparent"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="throttle" className="text-[var(--fg)]">Throttle (minutes)</Label>
          <Input
            id="throttle"
            type="number"
            min={1}
            value={throttleMinutes}
            onChange={(e) => setThrottleMinutes(e.target.value)}
            className="mt-1 w-32 border-[var(--border)] bg-transparent"
          />
        </div>

        {!ruleId && (
          <>
            <CardHeader className="p-0 font-mono text-xs text-[var(--muted)]">NOTIFICATION CHANNEL</CardHeader>
            <div className="grid gap-4">
              <div>
                <Label className="text-[var(--fg)]">Channel type</Label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value)}
                  className="mt-1 w-full max-w-xs rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
                >
                  {CHANNEL_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="channelConfig" className="text-[var(--fg)]">Config (JSON)</Label>
                <textarea
                  id="channelConfig"
                  value={channelConfig}
                  onChange={(e) => setChannelConfig(e.target.value)}
                  placeholder={
                    channelType === "email"
                      ? '{"recipients": ["you@example.com"]}'
                      : channelType === "slack" || channelType === "discord"
                        ? '{"webhookUrl": "https://..."}'
                        : channelType === "pagerduty"
                          ? '{"integrationKey": "..."}'
                          : '{"url": "https://..."}'
                  }
                  rows={3}
                  className="mt-1 w-full rounded-sm border border-[var(--border)] bg-transparent p-2 font-mono text-sm text-[var(--fg)]"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
            {saving ? "Saving..." : ruleId ? "Update rule" : "Create rule"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/dashboard/${projectId}/settings/alerts`}>Cancel</Link>
          </Button>
        </div>
      </Card>
    </form>
  );
}
