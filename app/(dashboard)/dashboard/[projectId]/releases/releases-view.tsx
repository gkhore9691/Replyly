"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GitBranch, Loader2 } from "lucide-react";
import Link from "next/link";

interface Integration {
  connected: boolean;
  integration?: {
    id: string;
    githubUsername: string;
    githubRepoId: number | null;
    githubRepoName: string | null;
  } | null;
}

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

export function ReleasesView({
  projectId,
  ReleaseTimeline,
  ReleaseList,
}: {
  projectId: string;
  ReleaseTimeline: React.ComponentType<{ releases: Release[] }>;
  ReleaseList: React.ComponentType<{
    releases: Release[];
    projectId: string;
  }>;
}) {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled) {
          setIntegration(null);
          setReleases([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!integration?.connected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
        <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Connect GitHub</h3>
        <p className="text-muted-foreground mb-4 text-center max-w-md">
          Connect your GitHub repository to track releases and correlate errors
          with deployments.
        </p>
        <Link href={`/api/auth/github?projectId=${projectId}`}>
          <Button>Connect GitHub</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/${projectId}/settings`}>Settings</Link>
        </Button>
      </div>
      <ReleaseTimeline releases={releases} />
      <ReleaseList releases={releases} projectId={projectId} />
    </>
  );
}
