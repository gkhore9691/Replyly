import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DashboardOverview projectId={projectId} />;
}
