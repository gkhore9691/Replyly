import { getAuthToken } from "@/lib/auth/session";

export async function getReleaseDetail(
  projectId: string,
  releaseId: string
): Promise<{
  release: {
    id: string;
    version: string;
    deployedAt: Date;
    author: string | null;
    environment: string;
  };
  commit: { sha: string; message: string; author: string } | null;
  errorGroups: Array<{
    errorHash: string;
    count: number;
    errorMessage?: string;
    route?: string;
    sampleEventId?: string;
    lastSeen?: string;
  }>;
} | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = await getAuthToken();
  if (!token) return null;

  const res = await fetch(
    `${base}/api/projects/${projectId}/releases/${releaseId}`,
    {
      headers: { cookie: `replayly_token=${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) return null;
  return res.json();
}
