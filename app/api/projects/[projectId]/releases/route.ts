import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";
import { mongodb } from "@/lib/db/mongodb";

async function getErrorStatsForRelease(
  projectId: string,
  commitSha: string,
  deployedAt: Date
): Promise<{ errorCount: number; totalCount: number; errorRate: number }> {
  const db = await mongodb.getDb();
  const collection = db.collection("events");
  const oneHourAfter = new Date(deployedAt.getTime() + 60 * 60 * 1000);

  const [errorCount, totalCount] = await Promise.all([
    collection.countDocuments({
      projectId,
      gitCommitSha: commitSha,
      isError: true,
      timestamp: { $gte: deployedAt, $lte: oneHourAfter },
    }),
    collection.countDocuments({
      projectId,
      gitCommitSha: commitSha,
      timestamp: { $gte: deployedAt, $lte: oneHourAfter },
    }),
  ]);

  return {
    errorCount,
    totalCount,
    errorRate: totalCount > 0 ? (errorCount / totalCount) * 100 : 0,
  };
}

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

    const releases = await prisma.release.findMany({
      where: { projectId },
      orderBy: { deployedAt: "desc" },
      take: 50,
    });

    const releasesWithStats = await Promise.all(
      releases.map(async (release) => {
        const stats = await getErrorStatsForRelease(
          projectId,
          release.commitSha,
          release.deployedAt
        );
        return { ...release, stats };
      })
    );

    return NextResponse.json({ releases: releasesWithStats });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
