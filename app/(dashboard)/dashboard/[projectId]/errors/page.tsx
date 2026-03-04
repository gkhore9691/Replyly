import { ErrorGroupList } from "@/components/dashboard/error-groups/error-group-list";

export default async function ErrorsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Error groups</h1>
        <p className="text-muted-foreground">
          Errors grouped by hash — click to view a sample event
        </p>
      </div>
      <ErrorGroupList projectId={projectId} />
    </div>
  );
}
