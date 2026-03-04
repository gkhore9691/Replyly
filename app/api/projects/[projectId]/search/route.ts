import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { searchEvents } from "@/lib/search/opensearch";

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

    const query = req.nextUrl.searchParams.get("q");
    if (!query?.trim()) {
      return NextResponse.json(
        { error: "Missing query" },
        { status: 400 }
      );
    }

    const results = await searchEvents(projectId, query.trim());
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
