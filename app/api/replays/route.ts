import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { mongodb } from "@/lib/db/mongodb";
import { prisma } from "@/lib/db/postgres";
import { z } from "zod";

const ReplayResultSchema = z.object({
  eventId: z.string(),
  mode: z.string(),
  success: z.boolean(),
  duration: z.number(),
  differences: z.any().optional(),
  error: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ReplayResultSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { eventId, mode, success, duration, differences, error } =
      parsed.data;

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

    const replay = await (prisma as unknown as {
      replayHistory: { create(args: unknown): Promise<unknown> };
    }).replayHistory.create({
      data: {
        eventId,
        projectId,
        userId: auth.user.userId,
        mode,
        success,
        duration,
        differences: differences ?? null,
        error,
      },
    });

    return NextResponse.json({ replay });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("[POST /api/replays]", err);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

