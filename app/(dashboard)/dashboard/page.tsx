import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

async function getOrganizationsAndProjects() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const token = cookieStore.get("replayly_token")?.value;
  if (!token) return { organizations: [], projectsByOrg: {} as Record<string, { id: string; name: string; slug: string }[]> };

  const [orgsRes, meRes] = await Promise.all([
    fetch(`${base}/api/organizations`, {
      headers: { cookie: `replayly_token=${token}` },
      cache: "no-store",
    }),
    fetch(`${base}/api/auth/me`, {
      headers: { cookie: `replayly_token=${token}` },
      cache: "no-store",
    }),
  ]);

  if (!orgsRes.ok || !meRes.ok) return { organizations: [], projectsByOrg: {} as Record<string, { id: string; name: string; slug: string }[]> };

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

export default async function DashboardPage() {
  const { organizations, projectsByOrg } = await getOrganizationsAndProjects();

  const firstProject = organizations.flatMap((o: { id: string }) => projectsByOrg[o.id] ?? [])[0];
  if (firstProject && organizations.length === 1 && (projectsByOrg[organizations[0].id]?.length ?? 0) === 1) {
    redirect(`/dashboard/${firstProject.id}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Select a project or create a new one to get started
        </p>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No organizations</CardTitle>
            <CardDescription>
              Create an organization and project to start capturing events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/new-organization">Create organization</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {organizations.map((org: { id: string; name: string; slug: string }) => (
            <Card key={org.id}>
              <CardHeader>
                <CardTitle>{org.name}</CardTitle>
                <CardDescription>Organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm font-medium">Projects</p>
                <ul className="space-y-2">
                  {(projectsByOrg[org.id] ?? []).map((p: { id: string; name: string; slug: string }) => (
                    <li key={p.id}>
                      <Link
                        href={`/dashboard/${p.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/new-project?orgId=${org.id}`}>
                    <Plus className="h-4 w-4 mr-2" />
                    New project
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
