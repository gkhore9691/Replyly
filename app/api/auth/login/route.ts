import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/postgres";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { setAuthCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: true },
    });

    const organizationIds = memberships.map((m) => m.organizationId);

    const token = signToken({
      userId: user.id,
      email: user.email,
      organizationIds,
    });

    await setAuthCookie(token);

    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organizations,
      token,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 }
    );
  }
}
