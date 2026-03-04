import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import { requireProjectPermission, Permission } from "@/lib/auth/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await verifyAuth(_req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    await requireProjectPermission(
      auth.user.userId,
      projectId,
      Permission.PROJECT_VIEW_EVENTS
    );

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        organization: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const byId = new Map<
      string,
      { id: string; name: string | null; email: string }
    >();
    for (const m of project.members) {
      byId.set(m.user.id, m.user);
    }
    for (const m of project.organization.members) {
      if (!byId.has(m.user.id)) byId.set(m.user.id, m.user);
    }

    const members = Array.from(byId.values());
    return NextResponse.json({ members });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
