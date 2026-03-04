import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { mongodb } from "@/lib/db/mongodb";
import { prisma } from "@/lib/db/postgres";
import { z } from "zod";

const SnapshotSchema = z.object({
  eventId: z.string(),
  database: z.string(),
  tables: z.record(z.any()),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = SnapshotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { eventId, database, tables } = parsed.data;

    const db = await mongodb.getDb();
    const collection = db.collection("events");

    const event = await collection.findOne<{ projectId?: string }>({
      requestId: eventId,
    });

    if (!event?.projectId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const hasAccess = await verifyProjectAccess(
      auth.user.userId,
      String(event.projectId)
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await (prisma as unknown as {
      snapshot: { create(args: unknown): Promise<unknown> };
    }).snapshot.create({
      data: {
        eventId,
        projectId: String(event.projectId),
        database,
        tables,
      },
    });

    return NextResponse.json({ snapshot });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("[POST /api/snapshots]", err);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

