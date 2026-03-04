import { notFound } from "next/navigation";
import { ActivityFeedView } from "@/components/dashboard/activity/ActivityFeedView";

export default async function ActivityFeedPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Activity Feed</h1>
      <ActivityFeedView projectId={projectId} />
    </div>
  );
}
