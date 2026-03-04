import Link from "next/link";
import { ProjectsListWithSdk } from "@/components/dashboard/ProjectsListWithSdk";

async function getOrganizationsAndProjects() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const token = cookieStore.get("replayly_token")?.value;
  if (!token)
    return { organizations: [], projectsByOrg: {} as Record<string, { id: string; name: string; slug: string }[]> };

  const orgsRes = await fetch(`${base}/api/organizations`, {
    headers: { cookie: `replayly_token=${token}` },
    cache: "no-store",
  });
  if (!orgsRes.ok) return { organizations: [], projectsByOrg: {} as Record<string, { id: string; name: string; slug: string }[]> };
  const orgs = (await orgsRes.json()).organizations ?? [];
  const projectsByOrg: Record<string, { id: string; name: string; slug: string }[]> = {};

  for (const org of orgs) {
    const projRes = await fetch(`${base}/api/organizations/${org.id}/projects`, {
      headers: { cookie: `replayly_token=${token}` },
      cache: "no-store",
    });
    if (projRes.ok) {
      const data = await projRes.json();
      projectsByOrg[org.id] = data.projects ?? [];
    } else {
      projectsByOrg[org.id] = [];
    }
  }
  return { organizations: orgs, projectsByOrg };
}

export default async function ProjectsPage() {
  const { organizations, projectsByOrg } = await getOrganizationsAndProjects();
  const allProjects: { id: string; name: string; slug: string; orgName: string }[] = [];
  for (const org of organizations as { id: string; name: string; slug: string }[]) {
    for (const p of projectsByOrg[org.id] ?? []) {
      allProjects.push({ ...p, orgName: org.name });
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
          ( PROJECTS )
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
          Connected projects
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          SDK setup instructions for each project
        </p>
      </div>
      <ProjectsListWithSdk projects={allProjects} />
    </div>
  );
}
