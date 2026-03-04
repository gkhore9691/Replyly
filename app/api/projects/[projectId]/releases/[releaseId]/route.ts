import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";
import { mongodb } from "@/lib/db/mongodb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; releaseId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, releaseId } = await params;
    const hasAccess = await verifyProjectAccess(user.user.userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { project: true },
    });

    if (!release || release.projectId !== projectId) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    const commit = await prisma.commit.findUnique({
      where: {
        projectId_sha: {
          projectId,
          sha: release.commitSha,
        },
      },
    });

    const db = await mongodb.getDb();
    const collection = db.collection("events");

    const errors = await collection
      .find({
        projectId,
        gitCommitSha: release.commitSha,
        isError: true,
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    const errorGroups = await collection
      .aggregate([
        {
          $match: {
            projectId,
            gitCommitSha: release.commitSha,
            isError: true,
          },
        },
        {
          $group: {
            _id: "$errorHash",
            count: { $sum: 1 },
            errorMessage: { $first: "$errorMessage" },
            route: { $first: "$route" },
            sampleEventId: { $first: "$requestId" },
            lastSeen: { $max: "$timestamp" },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const errorGroupsList = errorGroups.map((g: Record<string, unknown>) => ({
      errorHash: g._id,
      count: g.count,
      errorMessage: g.errorMessage,
      route: g.route,
      sampleEventId: g.sampleEventId,
      lastSeen: g.lastSeen,
    }));

    return NextResponse.json({
      release,
      commit,
      errors,
      errorGroups: errorGroupsList,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
