import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: auth.user.userId },
    include: { organization: true },
  });

  const organizations = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role,
  }));

  return NextResponse.json({
    user: {
      id: auth.user.userId,
      email: auth.user.email,
      name: (await prisma.user.findUnique({
        where: { id: auth.user.userId },
        select: { name: true },
      }))?.name ?? null,
    },
    organizations,
  });
}
