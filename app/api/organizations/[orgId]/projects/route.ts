import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyOrganizationAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";
import { createProjectSchema } from "@/lib/validations/organization";
import { slugify } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await verifyAuth(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  const hasAccess = await verifyOrganizationAccess(auth.user.userId, orgId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      organizationId: p.organizationId,
      environment: p.environment,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await verifyAuth(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  const hasAccess = await verifyOrganizationAccess(auth.user.userId, orgId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const slug = parsed.data.slug ?? slugify(parsed.data.name);

    const existing = await prisma.project.findUnique({
      where: {
        organizationId_slug: { organizationId: orgId, slug },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A project with this name already exists" },
        { status: 409 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        slug,
        organizationId: orgId,
      },
    });

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        organizationId: project.organizationId,
        environment: project.environment,
        createdAt: project.createdAt,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
