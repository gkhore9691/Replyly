import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TeamSettingsView } from "@/components/dashboard/settings/TeamSettingsView";
import { Users } from "lucide-react";

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
          ( TEAM )
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
          Team members
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Invite members to your organization. They will have access to all projects in the org.
        </p>
      </div>
      <TeamSettingsView projectId={projectId} />
      <Card>
        <CardHeader>
          <p className="font-mono text-xs text-[var(--muted)]">
            ( BACK )
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={`/dashboard/${projectId}/settings`}>
              Back to Settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
