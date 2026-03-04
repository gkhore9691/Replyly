import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { prisma } from "@/lib/db/postgres";
import { generateApiKey } from "@/lib/auth/api-key";
import { createApiKeySchema } from "@/lib/validations/organization";

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

  try {
    const body = await req.json();
    const parsed = createApiKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { key, hash, prefix } = generateApiKey(parsed.data.environment);

    const apiKey = await prisma.apiKey.create({
      data: {
        name: parsed.data.name,
        keyHash: hash,
        keyPrefix: prefix,
        projectId,
        userId: auth.user.userId,
      },
    });

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        key, // Only returned once; client must store it
        environment: parsed.data.environment,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
