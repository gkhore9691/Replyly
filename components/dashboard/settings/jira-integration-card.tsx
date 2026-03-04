"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function JiraIntegrationCard({ projectId }: { projectId: string }) {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/integrations/jira`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.integration) {
          setDomain(data.integration.domain ?? "");
          setProjectKey(data.integration.projectKey ?? "");
          setEnabled(data.integration.enabled ?? true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations/jira`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          email: email.trim(),
          apiToken: apiToken || undefined,
          projectKey: projectKey.trim(),
          enabled,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "ok", text: "Jira integration saved." });
        if (data.integration && apiToken) setApiToken("");
      } else {
        setMessage({ type: "err", text: data.error ?? "Failed to save" });
      }
    } catch {
      setMessage({ type: "err", text: "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <p className="font-mono text-xs text-[var(--muted)]">( JIRA )</p>
          <p className="text-sm text-[var(--muted)] mt-1">
            Link errors to Jira issues
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs text-[var(--muted)]">( JIRA )</p>
        <p className="text-sm text-[var(--muted)] mt-1">
          Link errors to Jira issues. Configure once, then use &quot;Link to issue tracker&quot; on any error.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          {message && (
            <p
              className={
                message.type === "ok"
                  ? "text-sm text-[var(--accent)]"
                  : "text-sm text-[var(--red)]"
              }
            >
              {message.text}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jira-domain">Jira domain</Label>
              <Input
                id="jira-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="company.atlassian.net"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jira-project-key">Project key</Label>
              <Input
                id="jira-project-key"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                placeholder="PROJ"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jira-email">Email (Atlassian account)</Label>
            <Input
              id="jira-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jira-token">API token</Label>
            <Input
              id="jira-token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={domain ? "Leave blank to keep existing" : "Create at id.atlassian.com"}
              autoComplete="off"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="jira-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="jira-enabled">Enable Jira integration</Label>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
