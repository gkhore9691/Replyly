import { prisma } from "@/lib/db/postgres";

export async function verifyProjectAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
  });
  return project !== null;
}

export async function verifyOrganizationAccess(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const member = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
  });
  return member !== null;
}
