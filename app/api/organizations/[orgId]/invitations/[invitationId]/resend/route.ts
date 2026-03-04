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
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; invitationId: string }> }
) {
  const auth = await verifyAuth(_req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orgId, invitationId } = await params;

    await requireOrganizationPermission(
      auth.user.userId,
      orgId,
      Permission.ORG_MANAGE_MEMBERS
    );

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: true,
        inviter: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "Invitation was already accepted" },
        { status: 400 }
      );
    }

    const newToken = randomBytes(32).toString("hex");
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { token: newToken, expiresAt: newExpiresAt },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const acceptUrl = `${baseUrl}/invitations/${newToken}`;

    const resend = getResend();
    if (resend) {
      try {
        const result = await resend.emails.send({
          from: INVITATION_FROM,
          to: invitation.email,
          subject: `Reminder: You're invited to ${invitation.organization!.name} on Replayly`,
          react: React.createElement(InvitationEmail, {
            inviterName:
              invitation.inviter.name ??
              invitation.inviter.email ??
              "A team member",
            organizationName: invitation.organization!.name,
            role: invitation.role,
            acceptUrl,
          }),
        });
        if ((result as unknown as { error?: unknown }).error) {
          const errVal = (result as unknown as { error?: unknown }).error;
          console.error("[Resend] Resend invitation email failed:", {
            invitationId: invitation.id,
            to: invitation.email,
            from: INVITATION_FROM,
            error: errVal,
            errorMessage: String(errVal),
          });
          throw new Error("Resend failed to send invitation email");
        }
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        console.error("[Resend] Resend invitation email error:", {
          invitationId: invitation.id,
          to: invitation.email,
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
      action: "invitation.resent",
      resource: "invitation",
      resourceId: invitation.id,
      metadata: { email: invitation.email },
    });

    return NextResponse.json({
      ok: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: newExpiresAt.toISOString(),
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to resend invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
