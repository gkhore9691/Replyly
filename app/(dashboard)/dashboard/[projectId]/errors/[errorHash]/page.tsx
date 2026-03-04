import Link from "next/link";
import { EventList } from "@/components/dashboard/event-list";
import { Button } from "@/components/ui/button";
import { ErrorAssignmentCard } from "@/components/dashboard/errors/ErrorAssignmentCard";
import { ErrorCommentsCard } from "@/components/dashboard/errors/ErrorCommentsCard";
import { ErrorIssueLinksCard } from "@/components/dashboard/errors/ErrorIssueLinksCard";
import { ArrowLeft } from "lucide-react";

export default async function ErrorGroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; errorHash: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId, errorHash } = await params;
  const filters = (await searchParams) ?? {};
  const decodedHash = decodeURIComponent(errorHash);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/${projectId}/errors`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to error groups
          </Button>
        </Link>
      </div>
      <div>
        <h1 className="text-3xl font-bold">Events for this error</h1>
        <p className="text-[var(--muted)] font-mono text-sm">
          Hash: {decodedHash}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <EventList
            projectId={projectId}
            filters={{ ...filters, errorHash: decodedHash }}
          />
        </div>
        <div className="space-y-6">
          <ErrorAssignmentCard
            projectId={projectId}
            errorHash={decodedHash}
          />
          <ErrorCommentsCard
            projectId={projectId}
            errorHash={decodedHash}
          />
          <ErrorIssueLinksCard
            projectId={projectId}
            errorHash={decodedHash}
          />
        </div>
      </div>
    </div>
  );
}
