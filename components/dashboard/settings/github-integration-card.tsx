"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";

const baseUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function GitHubIntegrationCard({ projectId }: { projectId: string }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [repoName, setRepoName] = useState<string | null>(null);
  const [repos, setRepos] = useState<Array<{ id: number; fullName: string }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/integrations/github`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setConnected(false);
          return;
        }
        setConnected(data.connected);
        setRepoName(data.integration?.githubRepoName ?? null);
      })
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!connected) return;
    fetch(`/api/projects/${projectId}/integrations/github/repos`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && Array.isArray(data.repos)) {
          setRepos(
            data.repos.map((r: { id: number; fullName: string }) => ({
              id: r.id,
              fullName: r.fullName,
            }))
          );
        }
      })
      .catch(() => {});
  }, [projectId, connected]);

  const handleRepoChange = (value: string) => {
    const repo = repos.find((r) => r.fullName === value);
    if (!repo) return;
    setSaving(true);
    fetch(`/api/projects/${projectId}/integrations/github`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        githubRepoId: repo.id,
        githubRepoName: repo.fullName,
      }),
    })
      .then((res) => {
        if (res.ok) setRepoName(repo.fullName);
      })
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="h-20 w-full rounded-sm bg-white/5 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs text-[var(--muted)]">
          ( GITHUB )
        </p>
        <p className="text-sm text-[var(--muted)] mt-1">
          Connect a repository to track releases and correlate errors with deployments via webhooks.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <Link href={`/api/auth/github?projectId=${projectId}`}>
            <Button className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
              <GitBranch className="mr-2 h-4 w-4" />
              Connect GitHub
            </Button>
          </Link>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-[var(--green)]">
              <CheckCircle className="h-4 w-4" />
              <span>Connected</span>
            </div>
            {repos.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--muted)]">Repository</label>
                <select
                  className="flex h-10 w-full rounded-sm border border-[var(--border)] bg-[#111] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  value={repoName ?? ""}
                  onChange={(e) => handleRepoChange(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select repository</option>
                  {repos.map((r) => (
                    <option key={r.id} value={r.fullName}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted)]">Webhook URL</label>
              <p className="text-sm font-mono text-[var(--muted)] bg-[#050505] border border-[var(--border)] px-3 py-2 rounded-sm break-all">
                {baseUrl}/api/webhooks/github
              </p>
              <p className="text-xs text-[var(--muted)]">
                In your repo: Settings → Webhooks → Add webhook. Content type: application/json. Events: Deployments, Pushes.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
