import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import {
  requireProjectPermission,
  hasProjectPermission,
  Permission,
} from "@/lib/auth/permissions";
import { logActivity } from "@/lib/audit/logger";

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

    const assignment = await prisma.errorGroupAssignment.findUnique({
      where: {
        projectId_errorHash: {
          projectId,
          errorHash: decodeURIComponent(errorHash),
        },
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ assignment: null }, { status: 200 });
    }
    return NextResponse.json({ assignment });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; errorHash: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, errorHash } = await params;
    await requireProjectPermission(
      auth.user.userId,
      projectId,
      Permission.PROJECT_ASSIGN_ISSUES
    );

    const body = await req.json();
    const { assigneeId, status } = body as {
      assigneeId?: string;
      status?: string;
    };

    if (!assigneeId) {
      return NextResponse.json(
        { error: "assigneeId is required" },
        { status: 400 }
      );
    }

    const assigneeHasAccess = await hasProjectPermission(
      assigneeId,
      projectId,
      Permission.PROJECT_VIEW_ERRORS
    );
    if (!assigneeHasAccess) {
      return NextResponse.json(
        { error: "Assignee does not have access to this project" },
        { status: 400 }
      );
    }

    const assignment = await prisma.errorGroupAssignment.upsert({
      where: {
        projectId_errorHash: {
          projectId,
          errorHash: decodeURIComponent(errorHash),
        },
      },
      create: {
        projectId,
        errorHash: decodeURIComponent(errorHash),
        assigneeId,
        status: (status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED") ?? "OPEN",
        assignedBy: auth.user.userId,
      },
      update: {
        assigneeId,
        status: (status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED") ?? "OPEN",
        assignedBy: auth.user.userId,
        assignedAt: new Date(),
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await logActivity({
      projectId,
      userId: auth.user.userId,
      type: "ERROR_ASSIGNED",
      metadata: {
        errorHash: decodeURIComponent(errorHash),
        assigneeId,
        assigneeName: assignment.assignee.name ?? assignment.assignee.email,
      },
    });

    return NextResponse.json({ assignment });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to assign issue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; errorHash: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, errorHash } = await params;
    await requireProjectPermission(
      auth.user.userId,
      projectId,
      Permission.PROJECT_ASSIGN_ISSUES
    );

    const body = await req.json();
    const { status } = body as { status?: string };

    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    const assignment = await prisma.errorGroupAssignment.update({
      where: {
        projectId_errorHash: {
          projectId,
          errorHash: decodeURIComponent(errorHash),
        },
      },
      data: {
        status: status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED",
        ...(status === "RESOLVED" && {
          resolvedAt: new Date(),
          resolvedBy: auth.user.userId,
        }),
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (status === "RESOLVED") {
      await logActivity({
        projectId,
        userId: auth.user.userId,
        type: "ERROR_RESOLVED",
        metadata: {
          errorHash: decodeURIComponent(errorHash),
        },
      });
    }

    return NextResponse.json({ assignment });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
