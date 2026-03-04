import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/postgres";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { setAuthCookie } from "@/lib/auth/session";
import { signupSchema } from "@/lib/validations/auth";
import { slugify } from "@/lib/utils";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, name, organizationName } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const orgSlug = slugify(organizationName);
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "An organization with this name already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: orgSlug,
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: Role.OWNER,
      },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      organizationIds: [organization.id],
    });

    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      token,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
