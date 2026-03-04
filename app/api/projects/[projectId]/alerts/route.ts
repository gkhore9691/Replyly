import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";
import { z } from "zod";

const alertChannelSchema = z.object({
  type: z.enum(["email", "slack", "discord", "pagerduty", "webhook"]),
  config: z.record(z.unknown()),
});

const createAlertRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  conditions: z.array(z.object({
    type: z.enum(["error_rate", "response_time", "status_code", "spike", "custom_query"]),
    operator: z.enum(["gt", "gte", "lt", "lte", "eq"]),
    threshold: z.number(),
    timeWindow: z.number().min(1),
    aggregation: z.enum(["avg", "p95", "p99", "count", "sum"]).optional(),
    filters: z.record(z.unknown()).optional(),
    customQuery: z.string().optional(),
  })),
  channels: z.array(alertChannelSchema).min(1),
  throttleMinutes: z.number().min(1).max(1440).optional(),
});

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

  const rules = await prisma.alertRule.findMany({
    where: { projectId },
    include: { channels: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    rules: rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      enabled: r.enabled,
      conditions: r.conditions as unknown[],
      channels: r.channels,
      throttleMinutes: r.throttleMinutes,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(
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

  const body = await req.json();
  const parsed = createAlertRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, description, conditions, channels, throttleMinutes } = parsed.data;

  const rule = await prisma.alertRule.create({
    data: {
      projectId,
      name,
      description: description ?? null,
      conditions: conditions as unknown as Prisma.InputJsonValue,
      throttleMinutes: throttleMinutes ?? 5,
      createdBy: auth.user.userId,
      channels: {
        create: channels.map((ch) => ({
          type: ch.type,
          config: ch.config as Prisma.InputJsonValue,
          enabled: true,
        })),
      },
    },
    include: { channels: true },
  });

  return NextResponse.json({
    rule: {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      conditions: rule.conditions,
      channels: rule.channels,
      throttleMinutes: rule.throttleMinutes,
      createdAt: rule.createdAt,
    },
  });
}
