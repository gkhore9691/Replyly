import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";
import { z } from "zod";

const PatchSchema = z.object({
  githubRepoId: z.number().int().positive(),
  githubRepoName: z.string().min(1),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const hasAccess = await verifyProjectAccess(user.user.userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const integration = await prisma.gitHubIntegration.findUnique({
      where: { projectId },
      select: {
        id: true,
        githubUsername: true,
        githubRepoId: true,
        githubRepoName: true,
        createdAt: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ connected: false, integration: null });
    }

    return NextResponse.json({
      connected: true,
      integration: {
        id: integration.id,
        githubUsername: integration.githubUsername,
        githubRepoId: integration.githubRepoId,
        githubRepoName: integration.githubRepoName,
        createdAt: integration.createdAt,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const hasAccess = await verifyProjectAccess(user.user.userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const integration = await prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });
    if (!integration) {
      return NextResponse.json(
        { error: "GitHub not connected for this project" },
        { status: 404 }
      );
    }

    await prisma.gitHubIntegration.update({
      where: { projectId },
      data: {
        githubRepoId: parsed.data.githubRepoId,
        githubRepoName: parsed.data.githubRepoName,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
