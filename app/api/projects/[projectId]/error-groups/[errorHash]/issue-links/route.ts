import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import { requireProjectPermission, Permission } from "@/lib/auth/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; errorHash: string }> }
) {
  const auth = await verifyAuth(_req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, errorHash } = await params;
    await requireProjectPermission(
      auth.user.userId,
      projectId,
      Permission.PROJECT_VIEW_ERRORS
    );

    const links = await prisma.issueLink.findMany({
      where: {
        projectId,
        errorHash: decodeURIComponent(errorHash),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ issueLinks: links });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch issue links";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
