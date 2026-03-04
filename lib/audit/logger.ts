import { prisma } from "@/lib/db/postgres";

const ACTIVITY_TYPES = [
  "EVENT_VIEWED",
  "ERROR_ASSIGNED",
  "ERROR_RESOLVED",
  "COMMENT_CREATED",
  "ISSUE_LINKED",
  "ALERT_TRIGGERED",
  "RELEASE_DEPLOYED",
  "MEMBER_INVITED",
  "MEMBER_JOINED",
  "SETTINGS_UPDATED",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export async function logActivity(data: {
  projectId?: string;
  organizationId?: string;
  userId: string;
  type: ActivityType;
  metadata: Record<string, unknown>;
}) {
  if (!ACTIVITY_TYPES.includes(data.type as ActivityType)) {
    return;
  }
  await prisma.activityLog.create({
    data: {
      projectId: data.projectId,
      organizationId: data.organizationId,
      userId: data.userId,
      type: data.type as (typeof ACTIVITY_TYPES)[number],
      metadata: data.metadata as object,
    },
  });
}

export async function logAudit(data: {
  organizationId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      metadata: data.metadata as object,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    },
  });
}
