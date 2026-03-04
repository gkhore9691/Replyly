import { ReleaseList } from "@/components/dashboard/releases/release-list";
import { ReleasesTimelineView } from "@/components/dashboard/releases/ReleasesTimelineView";

export default async function ReleasesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
          ( RELEASES )
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
          Releases
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Track deployments and correlate errors with releases
        </p>
      </div>
      <ReleasesTimelineView projectId={projectId} ReleaseList={ReleaseList} />
    </div>
  );
}
