import { getAuthToken } from "./session";
import { verifyToken } from "./jwt";
import { prisma } from "@/lib/db/postgres";

export async function getServerSession(): Promise<{
  user: { id: string; email: string; name: string | null };
  organizations: { id: string; name: string; role: string }[];
} | null> {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) return null;

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: true },
    });

    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
    }));

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organizations,
    };
  } catch {
    return null;
  }
}
