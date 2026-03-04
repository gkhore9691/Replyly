import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import {
  requireOrganizationPermission,
  Permission,
} from "@/lib/auth/permissions";
import { Resend } from "resend";
import * as React from "react";
import { InvitationEmail } from "@/lib/email/templates/invitation";
import { randomBytes } from "crypto";
import { logAudit } from "@/lib/audit/logger";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

const INVITATION_FROM =
  process.env.RESEND_INVITATION_FROM_EMAIL ?? "gopala.khore@evalora.in";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await verifyAuth(req);
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

    const body = await req.json();
    const { email, role } = body as { email?: string; role?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            organizationId: orgId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member" },
          { status: 400 }
        );
      }
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        organizationId: orgId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "Invitation already sent" },
        { status: 400 }
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase().trim(),
        organizationId: orgId,
        role: role ?? "MEMBER",
        token,
        expiresAt,
        createdBy: auth.user.userId,
      },
      include: {
        organization: true,
        inviter: true,
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const acceptUrl = `${baseUrl}/invitations/${token}`;

    const resend = getResend();
    if (resend) {
      try {
        const result = await resend.emails.send({
          from: INVITATION_FROM,
          to: email,
          subject: `You've been invited to ${invitation.organization!.name} on Replayly`,
          react: React.createElement(InvitationEmail, {
            inviterName:
              invitation.inviter.name ?? invitation.inviter.email ?? "A team member",
            organizationName: invitation.organization!.name,
            role: invitation.role,
            acceptUrl,
          }),
        });
        if ((result as unknown as { error?: unknown }).error) {
          console.error("[Resend] Invitation email failed:", {
            invitationId: invitation.id,
            to: email,
            from: INVITATION_FROM,
            error: (result as unknown as { error?: unknown }).error,
            errorMessage: String(
              (result as unknown as { error?: unknown }).error
            ),
          });
          throw new Error(
            "Resend failed to send invitation email"
          );
        }
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        console.error("[Resend] Invitation email send error:", {
          invitationId: invitation.id,
          to: email,
          from: INVITATION_FROM,
          message: errObj.message,
          stack: errObj.stack,
        });
        throw err;
      }
    }

    await logAudit({
      organizationId: orgId,
      userId: auth.user.userId,
      action: "invitation.created",
      resource: "invitation",
      resourceId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    });

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviter: {
          name: invitation.inviter.name,
          email: invitation.inviter.email,
        },
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to send invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await verifyAuth(req);
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

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: orgId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        inviter: inv.inviter,
      })),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch invitations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
