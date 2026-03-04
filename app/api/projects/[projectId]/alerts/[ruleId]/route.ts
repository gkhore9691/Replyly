import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";
import { z } from "zod";

const updateAlertRuleSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  conditions: z.array(z.record(z.unknown())).optional(),
  throttleMinutes: z.number().min(1).max(1440).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; ruleId: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, ruleId } = await params;
  const hasAccess = await verifyProjectAccess(auth.user.userId, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rule = await prisma.alertRule.findFirst({
    where: { id: ruleId, projectId },
  });
  if (!rule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateAlertRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const data: Prisma.AlertRuleUpdateInput = {
    ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
    ...(parsed.data.name !== undefined && { name: parsed.data.name }),
    ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    ...(parsed.data.conditions !== undefined && {
      conditions: parsed.data.conditions as unknown as Prisma.InputJsonValue,
    }),
    ...(parsed.data.throttleMinutes !== undefined && { throttleMinutes: parsed.data.throttleMinutes }),
  };

  const updated = await prisma.alertRule.update({
    where: { id: ruleId },
    data,
    include: { channels: true },
  });

  return NextResponse.json({
    rule: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      enabled: updated.enabled,
      conditions: updated.conditions,
      channels: updated.channels,
      throttleMinutes: updated.throttleMinutes,
      createdAt: updated.createdAt,
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; ruleId: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, ruleId } = await params;
  const hasAccess = await verifyProjectAccess(auth.user.userId, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rule = await prisma.alertRule.findFirst({
    where: { id: ruleId, projectId },
  });
  if (!rule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.alertRule.delete({
    where: { id: ruleId },
  });

  return new NextResponse(null, { status: 204 });
}
