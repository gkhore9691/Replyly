import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const hasAccess = await verifyProjectAccess(auth.user.userId, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const ruleId = searchParams.get("ruleId") || undefined;

  const history = await prisma.alertHistory.findMany({
    where: {
      rule: { projectId, ...(ruleId ? { id: ruleId } : {}) },
    },
    include: { rule: { select: { id: true, name: true } } },
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    history: history.map((h) => ({
      id: h.id,
      ruleId: h.ruleId,
      ruleName: h.rule.name,
      triggeredAt: h.triggeredAt,
      condition: h.condition,
      value: h.value,
      threshold: h.threshold,
      notificationsSent: h.notificationsSent,
      notificationsFailed: h.notificationsFailed,
      acknowledgedAt: h.acknowledgedAt,
      resolvedAt: h.resolvedAt,
    })),
  });
}
