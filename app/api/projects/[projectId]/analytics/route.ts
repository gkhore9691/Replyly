import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";

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

    const days = parseInt(
      req.nextUrl.searchParams.get("days") || "7",
      10
    );
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const stats = await prisma.dailyStats.findMany({
      where: {
        projectId,
        date: { gte: startDate },
      },
      orderBy: { date: "asc" },
    });

    const totals = stats.reduce(
      (acc, stat) => ({
        totalEvents: acc.totalEvents + stat.totalEvents,
        errorEvents: acc.errorEvents + stat.errorEvents,
        avgDuration: acc.avgDuration + stat.avgDurationMs,
      }),
      { totalEvents: 0, errorEvents: 0, avgDuration: 0 }
    );

    return NextResponse.json({
      stats,
      totals: {
        ...totals,
        avgDuration:
          stats.length > 0 ? totals.avgDuration / stats.length : 0,
        errorRate:
          totals.totalEvents > 0
            ? (totals.errorEvents / totals.totalEvents) * 100
            : 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
