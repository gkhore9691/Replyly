import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";
import { decryptToken } from "@/lib/integrations/github/token";

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
    });
    if (!integration) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 404 }
      );
    }

    const token = decryptToken(integration.accessToken);
    const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch repositories from GitHub" },
        { status: 502 }
      );
    }

    const repos = (await res.json()) as Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
    }>;

    return NextResponse.json({
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
