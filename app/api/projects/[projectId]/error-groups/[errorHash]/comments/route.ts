import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import { requireProjectPermission, Permission } from "@/lib/auth/permissions";
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

    const comments = await prisma.comment.findMany({
      where: {
        projectId,
        errorHash: decodeURIComponent(errorHash),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        mentions: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch comments";
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
      Permission.PROJECT_COMMENT
    );

    const body = await req.json();
    const { content, mentionIds } = body as {
      content?: string;
      mentionIds?: string[];
    };

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const decodedHash = decodeURIComponent(errorHash);
    const mentionUserIds: string[] = Array.isArray(mentionIds)
      ? mentionIds.filter((id): id is string => typeof id === "string")
      : [];

    const projectMemberIds = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    const orgMemberIds = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        organization: {
          select: { members: { select: { userId: true } } },
        },
      },
    });
    const allowedUserIds = new Set([
      ...projectMemberIds.map((m) => m.userId),
      ...(orgMemberIds?.organization.members.map((m) => m.userId) ?? []),
    ]);
    const validMentionIds = mentionUserIds.filter((id) => allowedUserIds.has(id));

    const comment = await prisma.comment.create({
      data: {
        projectId,
        errorHash: decodedHash,
        content: content.trim(),
        authorId: auth.user.userId,
        ...(validMentionIds.length > 0 && {
          mentions: {
            connect: validMentionIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        mentions: {
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
      type: "COMMENT_CREATED",
      metadata: {
        errorHash: decodedHash,
        commentId: comment.id,
      },
    });

    return NextResponse.json({ comment });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create comment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
