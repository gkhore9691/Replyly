import { prisma } from "@/lib/db/postgres";

export async function handleDeploymentEvent(_event: unknown): Promise<void> {
  // Deployment created; we create release only on deployment_status (success)
}

interface DeploymentStatusEvent {
  deployment_status?: { state?: string };
  deployment?: {
    sha?: string;
    ref?: string;
    environment?: string;
    creator?: { login?: string };
  };
  repository?: { id?: number };
}

export async function handleDeploymentStatusEvent(
  event: DeploymentStatusEvent
): Promise<void> {
  const status = event.deployment_status?.state;
  if (status !== "success") return;

  const deployment = event.deployment;
  const repoId = event.repository?.id;
  if (!deployment?.sha || !repoId) return;

  const integration = await prisma.gitHubIntegration.findFirst({
    where: { githubRepoId: repoId },
  });

  if (!integration) return;

  await prisma.release.create({
    data: {
      projectId: integration.projectId,
      version: deployment.ref ?? deployment.sha.slice(0, 7),
      commitSha: deployment.sha,
      branch: deployment.ref ?? null,
      author: deployment.creator?.login ?? null,
      deployedAt: new Date(),
      environment: deployment.environment ?? "production",
    },
  });
}

interface PushEventCommit {
  id?: string;
  message?: string;
  author?: { name?: string };
  timestamp?: string;
  url?: string;
}

interface PushEvent {
  repository?: { id?: number };
  commits?: PushEventCommit[];
}

export async function handlePushEvent(event: PushEvent): Promise<void> {
  const repoId = event.repository?.id;
  const commits = event.commits;
  if (!repoId || !commits?.length) return;

  const integration = await prisma.gitHubIntegration.findFirst({
    where: { githubRepoId: repoId },
  });

  if (!integration) return;

  for (const commit of commits) {
    if (!commit.id) continue;
    const message = commit.message ?? "";
    const author = commit.author?.name ?? "unknown";
    const timestamp = commit.timestamp ? new Date(commit.timestamp) : new Date();
    const url = commit.url ?? "";

    await prisma.commit.upsert({
      where: {
        projectId_sha: {
          projectId: integration.projectId,
          sha: commit.id,
        },
      },
      create: {
        projectId: integration.projectId,
        sha: commit.id,
        message,
        author,
        timestamp,
        url,
      },
      update: {},
    });
  }
}
