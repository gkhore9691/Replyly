import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Key, Bell, Users } from "lucide-react";
import { GitHubIntegrationCard } from "@/components/dashboard/settings/github-integration-card";
import { JiraIntegrationCard } from "@/components/dashboard/settings/jira-integration-card";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
          ( SETTINGS )
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          API keys, masking rules, retention, and team
        </p>
      </div>

      <GitHubIntegrationCard projectId={projectId} />
      <JiraIntegrationCard projectId={projectId} />

      <Card>
        <CardHeader>
          <p className="font-mono text-xs text-[var(--muted)]">
            ( ALERTS )
          </p>
          <p className="text-sm text-[var(--muted)] mt-1">
            Configure alert rules and notification channels
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
            <Link href={`/dashboard/${projectId}/settings/alerts`}>
              <Bell className="mr-2 h-4 w-4" />
              Manage Alerts
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-mono text-xs text-[var(--muted)]">
            ( API KEYS )
          </p>
          <p className="text-sm text-[var(--muted)] mt-1">
            Create and manage API keys for the Replayly SDK
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
            <Link href={`/dashboard/${projectId}/settings/api-keys`}>
              <Key className="mr-2 h-4 w-4" />
              Manage API Keys
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-mono text-xs text-[var(--muted)]">
            ( MASKING RULES )
          </p>
          <p className="text-sm text-[var(--muted)] mt-1">
            Redact sensitive fields (e.g. Authorization, password) from captured payloads
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">
            Configure which headers and body keys to mask before storage. Coming soon.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-mono text-xs text-[var(--muted)]">
            ( RETENTION )
          </p>
          <p className="text-sm text-[var(--muted)] mt-1">
            How long to keep events and replays
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">
            Set retention period (e.g. 30 days) for events. Coming soon.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-mono text-xs text-[var(--muted)]">
            ( TEAM MEMBERS )
          </p>
          <p className="text-sm text-[var(--muted)] mt-1">
            Invite team members to your organization
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
            <Link href={`/dashboard/${projectId}/settings/team`}>
              <Users className="mr-2 h-4 w-4" />
              Manage Team
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
