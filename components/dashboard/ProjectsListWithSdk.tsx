"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

interface Project {
  id: string;
  name: string;
  slug: string;
  orgName: string;
}

export function ProjectsListWithSdk({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-[var(--muted)] mb-4">
            No projects yet. Create an organization and project to get started.
          </p>
          <Button asChild className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
            <Link href="/dashboard/new-organization">Create organization</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/new-project">
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Link>
        </Button>
      </div>
      <div className="space-y-4">
        {projects.map((project) => (
          <ProjectSdkCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

function ProjectSdkCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const installCmd = "npm install @replayly/sdk";
  const initCode = `import { Replayly } from "@replayly/sdk";

Replayly.init({
  projectId: "${project.id}",
  ingestUrl: "${APP_URL}/api/ingest",
  apiKey: process.env.REPLAYLY_API_KEY,
});`;
  const envExample = `REPLAYLY_API_KEY=your_api_key_here`;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/${project.id}`}
            className="font-heading font-semibold text-[var(--fg)] hover:text-[var(--accent)]"
          >
            {project.name}
          </Link>
          <Badge variant="outline" className="font-mono text-xs">
            {project.orgName}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--muted)]"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? "Hide" : "SDK setup"}
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4 pt-0">
          <p className="font-mono text-xs text-[var(--muted)]">( INSTALL )</p>
          <div className="flex items-center gap-2 rounded-sm border border-[var(--border)] bg-[#050505] p-3 font-mono text-sm">
            <code className="flex-1 text-[var(--fg)]">{installCmd}</code>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => copy(installCmd, "install")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <p className="font-mono text-xs text-[var(--muted)]">( ENV )</p>
          <div className="flex items-center gap-2 rounded-sm border border-[var(--border)] bg-[#050505] p-3 font-mono text-sm">
            <code className="flex-1 text-[var(--fg)]">{envExample}</code>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => copy(envExample, "env")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <p className="font-mono text-xs text-[var(--muted)]">( INIT )</p>
          <div className="relative rounded-sm border border-[var(--border)] bg-[#050505] p-3 font-mono text-sm">
            <pre className="overflow-x-auto text-[var(--fg)] whitespace-pre">
              {initCode}
            </pre>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => copy(initCode, "init")}
            >
              {copied === "init" ? "Copied" : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Create an API key in{" "}
            <Link
              href={`/dashboard/${project.id}/settings/api-keys`}
              className="text-[var(--accent)] hover:underline"
            >
              Settings → API Keys
            </Link>{" "}
            and set it as REPLAYLY_API_KEY.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
