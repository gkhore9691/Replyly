import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { mongodb } from "@/lib/db/mongodb";
import { getEventPayload } from "@/lib/storage/minio";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; eventId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, eventId } = await params;
    const hasAccess = await verifyProjectAccess(user.user.userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await mongodb.getDb();
    const collection = db.collection("events");

    const event = await collection.findOne({
      requestId: eventId,
      projectId,
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const s3Pointer = event.s3Pointer as string | undefined;
    let fullPayload: unknown = null;
    if (s3Pointer) {
      try {
        fullPayload = await getEventPayload(s3Pointer);
      } catch {
        // payload may be missing; return metadata only
      }
    }

    const payload = fullPayload as Record<string, unknown> | null;
    const errorFromPayload = payload?.error;

    return NextResponse.json({
      ...event,
      error: event.error ?? errorFromPayload ?? undefined,
      fullPayload: fullPayload ?? {},
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
