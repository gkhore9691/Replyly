import { notFound } from "next/navigation";
import { ProjectLiveProvider } from "@/components/dashboard/ProjectLiveContext";

async function getProjectAccess(projectId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const token = cookieStore.get("replayly_token")?.value;
  if (!token) return false;

  const orgsRes = await fetch(`${base}/api/organizations`, {
    headers: { cookie: `replayly_token=${token}` },
    cache: "no-store",
  });
  if (!orgsRes.ok) return false;
  const orgs = (await orgsRes.json()).organizations ?? [];

  for (const org of orgs) {
    const projRes = await fetch(`${base}/api/organizations/${org.id}/projects`, {
      headers: { cookie: `replayly_token=${token}` },
      cache: "no-store",
    });
    if (!projRes.ok) continue;
    const projects = (await projRes.json()).projects ?? [];
    if (projects.some((p: { id: string }) => p.id === projectId)) {
      return true;
    }
  }
  return false;
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const hasAccess = await getProjectAccess(projectId);
  if (!hasAccess) {
    notFound();
  }
  return (
    <ProjectLiveProvider projectId={projectId}>
      {children}
    </ProjectLiveProvider>
  );
}
