import { prisma } from "@/lib/db/postgres";

export enum Permission {
  ORG_MANAGE_MEMBERS = "org:manage_members",
  ORG_MANAGE_BILLING = "org:manage_billing",
  ORG_MANAGE_SETTINGS = "org:manage_settings",
  ORG_CREATE_PROJECTS = "org:create_projects",
  ORG_VIEW_AUDIT_LOGS = "org:view_audit_logs",

  PROJECT_VIEW_EVENTS = "project:view_events",
  PROJECT_VIEW_ERRORS = "project:view_errors",
  PROJECT_REPLAY_EVENTS = "project:replay_events",
  PROJECT_MANAGE_API_KEYS = "project:manage_api_keys",
  PROJECT_MANAGE_SETTINGS = "project:manage_settings",
  PROJECT_MANAGE_MEMBERS = "project:manage_members",
  PROJECT_ASSIGN_ISSUES = "project:assign_issues",
  PROJECT_COMMENT = "project:comment",
  PROJECT_MANAGE_ALERTS = "project:manage_alerts",
  PROJECT_MANAGE_INTEGRATIONS = "project:manage_integrations",
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    Permission.ORG_MANAGE_MEMBERS,
    Permission.ORG_MANAGE_BILLING,
    Permission.ORG_MANAGE_SETTINGS,
    Permission.ORG_CREATE_PROJECTS,
    Permission.ORG_VIEW_AUDIT_LOGS,
  ],
  ADMIN: [
    Permission.ORG_MANAGE_MEMBERS,
    Permission.ORG_MANAGE_SETTINGS,
    Permission.ORG_CREATE_PROJECTS,
    Permission.ORG_VIEW_AUDIT_LOGS,
  ],
  MEMBER: [Permission.ORG_CREATE_PROJECTS],

  PROJECT_ADMIN: [
    Permission.PROJECT_VIEW_EVENTS,
    Permission.PROJECT_VIEW_ERRORS,
    Permission.PROJECT_REPLAY_EVENTS,
    Permission.PROJECT_MANAGE_API_KEYS,
    Permission.PROJECT_MANAGE_SETTINGS,
    Permission.PROJECT_MANAGE_MEMBERS,
    Permission.PROJECT_ASSIGN_ISSUES,
    Permission.PROJECT_COMMENT,
    Permission.PROJECT_MANAGE_ALERTS,
    Permission.PROJECT_MANAGE_INTEGRATIONS,
  ],
  DEVELOPER: [
    Permission.PROJECT_VIEW_EVENTS,
    Permission.PROJECT_VIEW_ERRORS,
    Permission.PROJECT_REPLAY_EVENTS,
    Permission.PROJECT_ASSIGN_ISSUES,
    Permission.PROJECT_COMMENT,
  ],
  VIEWER: [
    Permission.PROJECT_VIEW_EVENTS,
    Permission.PROJECT_VIEW_ERRORS,
  ],
};

export async function hasOrganizationPermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<boolean> {
  const member = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!member) return false;

  const permissions = ROLE_PERMISSIONS[member.role] ?? [];
  return permissions.includes(permission);
}

export async function hasProjectPermission(
  userId: string,
  projectId: string,
  permission: Permission
): Promise<boolean> {
  const projectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  if (projectMember) {
    const permissions =
      ROLE_PERMISSIONS[`PROJECT_${projectMember.role}`] ?? [];
    return permissions.includes(permission);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      organization: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!project || project.organization.members.length === 0) {
    return false;
  }

  const orgMember = project.organization.members[0];
  if (orgMember.role === "OWNER" || orgMember.role === "ADMIN") {
    return true;
  }

  return false;
}

export async function requireOrganizationPermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<void> {
  const hasPermission = await hasOrganizationPermission(
    userId,
    organizationId,
    permission
  );

  if (!hasPermission) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

export async function requireProjectPermission(
  userId: string,
  projectId: string,
  permission: Permission
): Promise<void> {
  const hasPermission = await hasProjectPermission(
    userId,
    projectId,
    permission
  );

  if (!hasPermission) {
    throw new Error(`Missing permission: ${permission}`);
  }
}
