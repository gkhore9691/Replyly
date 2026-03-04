import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import { requireOrganizationPermission, Permission } from "@/lib/auth/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await verifyAuth(_req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orgId } = await params;
    await requireOrganizationPermission(
      auth.user.userId,
      orgId,
      Permission.ORG_MANAGE_MEMBERS
    );

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        userId: m.userId,
        user: m.user,
        createdAt: m.createdAt,
      })),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
