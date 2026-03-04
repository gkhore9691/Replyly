import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import {
  requireProjectPermission,
  Permission,
} from "@/lib/auth/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await verifyAuth(_req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    await requireProjectPermission(
      auth.user.userId,
      projectId,
      Permission.PROJECT_MANAGE_INTEGRATIONS
    );

    const integration = await prisma.integration.findUnique({
      where: {
        projectId_provider: { projectId, provider: "jira" },
      },
    });

    if (!integration) {
      return NextResponse.json({ integration: null }, { status: 200 });
    }

    return NextResponse.json({
      integration: {
        id: integration.id,
        provider: integration.provider,
        enabled: integration.enabled,
        domain: (integration.config as { domain?: string })?.domain ?? null,
        projectKey: (integration.config as { projectKey?: string })?.projectKey ?? null,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch Jira integration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    await requireProjectPermission(
      auth.user.userId,
      projectId,
      Permission.PROJECT_MANAGE_INTEGRATIONS
    );

    const body = await req.json();
    const {
      domain,
      email,
      apiToken,
      projectKey,
      enabled = true,
    } = body as {
      domain?: string;
      email?: string;
      apiToken?: string;
      projectKey?: string;
      enabled?: boolean;
    };

    if (!domain || !email || !projectKey) {
      return NextResponse.json(
        {
          error: "domain, email, and projectKey are required",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.integration.findUnique({
      where: {
        projectId_provider: { projectId, provider: "jira" },
      },
    });

    const config = {
      domain: String(domain).trim(),
      email: String(email).trim(),
      apiToken:
        typeof apiToken === "string" && apiToken.trim()
          ? String(apiToken).trim()
          : (existing?.config as { apiToken?: string } | null)?.apiToken ?? "",
      projectKey: String(projectKey).trim(),
    };

    if (!existing && !config.apiToken) {
      return NextResponse.json(
        { error: "apiToken is required when creating a new integration" },
        { status: 400 }
      );
    }

    const integration = await prisma.integration.upsert({
      where: {
        projectId_provider: { projectId, provider: "jira" },
      },
      create: {
        projectId,
        provider: "jira",
        enabled: Boolean(enabled),
        config,
      },
      update: {
        enabled: Boolean(enabled),
        config,
      },
    });

    return NextResponse.json({
      integration: {
        id: integration.id,
        provider: integration.provider,
        enabled: integration.enabled,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to save Jira integration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
