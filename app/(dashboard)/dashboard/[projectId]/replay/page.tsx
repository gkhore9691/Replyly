import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

export default async function ReplayLandingPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div>
        <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
          ( REPLAY ENGINE )
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
          Replay
        </h1>
      </div>

      <Card>
        <CardHeader>
          <p className="font-mono text-xs text-[var(--muted)]">
            ( SELECT AN EVENT )
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Choose an event from the list to replay its request locally with Dry,
            Mock, or Hybrid mode.
          </p>
          <Button asChild className="bg-[var(--accent)] text-[var(--bg)] hover:opacity-90">
            <Link href={`/dashboard/${projectId}/events`}>
              <Activity className="mr-2 h-4 w-4" />
              Browse events
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
