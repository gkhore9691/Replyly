import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import { logAudit } from "@/lib/audit/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: "You must be signed in to accept an invitation" },
      { status: 401 }
    );
  }

  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "Invitation already accepted" },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    if (invitation.email.toLowerCase() !== auth.user.email.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "This invitation was sent to a different email address. Sign in with that account to accept.",
        },
        { status: 403 }
      );
    }

    const organizationId = invitation.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Invalid invitation: no organization" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const role =
        invitation.role === "OWNER" || invitation.role === "ADMIN"
          ? invitation.role
          : "MEMBER";

      await tx.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: auth.user.userId,
            organizationId,
          },
        },
        create: {
          userId: auth.user.userId,
          organizationId,
          role: role as "OWNER" | "ADMIN" | "MEMBER",
        },
        update: {},
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    await logAudit({
      organizationId,
      userId: auth.user.userId,
      action: "invitation.accepted",
      resource: "invitation",
      resourceId: invitation.id,
      metadata: { email: invitation.email },
    });

    return NextResponse.json({
      organizationId,
      message: "Invitation accepted",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to accept invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
