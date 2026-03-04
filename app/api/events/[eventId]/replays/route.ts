import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { mongodb } from "@/lib/db/mongodb";
import { prisma } from "@/lib/db/postgres";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;

    const db = await mongodb.getDb();
    const collection = db.collection("events");

    const event = await collection.findOne<{ projectId?: string }>({
      requestId: eventId,
    });

    if (!event?.projectId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const projectId = String(event.projectId);

    const hasAccess = await verifyProjectAccess(auth.user.userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const replays = await (prisma as unknown as {
      replayHistory: { findMany(args: unknown): Promise<unknown[]> };
    }).replayHistory.findMany({
      where: { eventId, projectId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ replays });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("[GET /api/events/[eventId]/replays]", err);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

