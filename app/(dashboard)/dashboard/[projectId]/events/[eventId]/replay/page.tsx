import { notFound } from "next/navigation";
import { ReplayView } from "@/components/dashboard/replay/ReplayView";

async function getEvent(projectId: string, eventId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const token = cookieStore.get("replayly_token")?.value;
  if (!token) return null;
  const res = await fetch(
    `${base}/api/projects/${projectId}/events/${eventId}`,
    {
      headers: { cookie: `replayly_token=${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
  const event = await getEvent(projectId, eventId);
  if (!event) notFound();

  return (
    <ReplayView
      projectId={projectId}
      eventId={eventId}
      event={event}
    />
  );
}
