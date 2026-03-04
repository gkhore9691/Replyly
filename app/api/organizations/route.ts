import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import { createOrganizationSchema } from "@/lib/validations/organization";
import { slugify } from "@/lib/utils";
import { Role } from "@prisma/client";

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
    slug: m.organization.slug,
    role: m.role,
  }));

  return NextResponse.json({ organizations });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createOrganizationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name } = parsed.data;
    const slug = slugify(name);

    const existing = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An organization with this name already exists" },
        { status: 409 }
      );
    }

    const organization = await prisma.organization.create({
      data: { name, slug },
    });

    await prisma.organizationMember.create({
      data: {
        userId: auth.user.userId,
        organizationId: organization.id,
        role: Role.OWNER,
      },
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
