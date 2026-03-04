import { EventsListPage } from "@/components/dashboard/EventsListPage";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  const filters = await searchParams;
  return <EventsListPage projectId={projectId} filters={filters} />;
}
