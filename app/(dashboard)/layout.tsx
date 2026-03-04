import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getServerSession } from "@/lib/auth/get-session";

async function getProjectsForUser() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const token = cookieStore.get("replayly_token")?.value;
  if (!token) return [];

  const orgsRes = await fetch(`${base}/api/organizations`, {
    headers: { cookie: `replayly_token=${token}` },
    cache: "no-store",
  });
  if (!orgsRes.ok) return [];
  const orgs = (await orgsRes.json()).organizations ?? [];
  const projects: { id: string; name: string }[] = [];

  for (const org of orgs) {
    const projRes = await fetch(
      `${base}/api/organizations/${org.id}/projects`,
      {
        headers: { cookie: `replayly_token=${token}` },
        cache: "no-store",
      }
    );
    if (!projRes.ok) continue;
    const data = await projRes.json();
    const list = data.projects ?? [];
    for (const p of list) {
      projects.push({ id: p.id, name: p.name ?? p.slug ?? p.id });
    }
  }
  return projects;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login");
  }

  const projects = await getProjectsForUser();

  return (
    <AppShell
      user={session.user}
      projects={projects}
      environment="PRODUCTION"
    >
      {children}
    </AppShell>
  );
}
