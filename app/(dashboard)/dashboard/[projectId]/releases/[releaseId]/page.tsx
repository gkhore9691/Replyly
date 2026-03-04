import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReleaseErrorGroupList } from "@/components/dashboard/releases/error-group-list";
import { ArrowLeft, GitCommit } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getReleaseDetail } from "./get-release";

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; releaseId: string }>;
}) {
  const { projectId, releaseId } = await params;
  const data = await getReleaseDetail(projectId, releaseId);

  if (!data) {
    notFound();
  }

  const { release, commit, errorGroups } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/${projectId}/releases`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Releases
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            <h1 className="text-3xl font-bold">{release.version}</h1>
          </div>
          <p className="text-muted-foreground">
            Deployed {new Date(release.deployedAt).toLocaleString()}
          </p>
          {release.author && (
            <p className="text-sm text-muted-foreground">by {release.author}</p>
          )}
        </div>
        <Badge>{release.environment}</Badge>
      </div>

      {commit && (
        <Card>
          <CardHeader>
            <CardTitle>Commit details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm font-medium">SHA:</span>
              <code className="ml-2 text-sm bg-muted px-2 py-1 rounded">
                {commit.sha.substring(0, 8)}
              </code>
            </div>
            <div>
              <span className="text-sm font-medium">Message:</span>
              <p className="text-sm text-muted-foreground mt-1">
                {commit.message}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium">Author:</span>
              <span className="ml-2 text-sm">{commit.author}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold mb-4">
          Errors ({errorGroups.length})
        </h2>
        <ReleaseErrorGroupList
          errorGroups={errorGroups}
          projectId={projectId}
        />
      </div>
    </div>
  );
}
