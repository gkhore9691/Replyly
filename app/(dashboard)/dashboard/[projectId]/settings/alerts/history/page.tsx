import { AlertHistoryList } from "@/components/dashboard/alerts/AlertHistoryList";

export default async function AlertHistoryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <AlertHistoryList projectId={projectId} />;
}
