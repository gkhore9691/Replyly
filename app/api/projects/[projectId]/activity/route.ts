import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import { requireProjectPermission, Permission } from "@/lib/auth/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await verifyAuth(req);
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

    const limit = Math.min(
      Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50),
      100
    );

    const activities = await prisma.activityLog.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        metadata: a.metadata,
        createdAt: a.createdAt,
        user: a.user,
      })),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch activity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
