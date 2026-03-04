import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { mongodb } from "@/lib/db/mongodb";
import { prisma } from "@/lib/db/postgres";
import { z } from "zod";

const UpdateMockSchema = z.object({
  response: z.any(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; mockId: string }> }
) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId, mockId } = await params;

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

    const body = await req.json();
    const parsed = UpdateMockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = await (prisma as unknown as {
      eventMock: { update(args: unknown): Promise<unknown> };
    }).eventMock.update({
      where: { id: mockId },
      data: {
        response: parsed.data.response,
      },
    });

    return NextResponse.json({ mock: updated });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("[PATCH /api/events/[eventId]/mocks/[mockId]]", err);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

