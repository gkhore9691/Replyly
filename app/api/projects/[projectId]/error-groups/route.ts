import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { mongodb } from "@/lib/db/mongodb";

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

    const db = await mongodb.getDb();
    const collection = db.collection("events");

    const errorGroups = await collection
      .aggregate([
        {
          $match: {
            projectId,
            isError: true,
            errorHash: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$errorHash",
            count: { $sum: 1 },
            lastSeen: { $max: "$timestamp" },
            firstSeen: { $min: "$timestamp" },
            errorMessage: { $first: "$errorMessage" },
            route: { $first: "$route" },
            sampleEventId: { $first: "$requestId" },
          },
        },
        { $sort: { lastSeen: -1 } },
        { $limit: 100 },
      ])
      .toArray();

    return NextResponse.json({
      errorGroups: errorGroups.map((group: Record<string, unknown>) => ({
        errorHash: group._id,
        count: group.count,
        lastSeen: group.lastSeen,
        firstSeen: group.firstSeen,
        errorMessage: group.errorMessage,
        route: group.route,
        sampleEventId: group.sampleEventId,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
