import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { prisma } from "@/lib/db/postgres";
import {
  requireProjectPermission,
  Permission,
} from "@/lib/auth/permissions";
import { JiraClient } from "@/lib/integrations/jira/client";
import { logActivity } from "@/lib/audit/logger";

interface JiraIntegrationConfig {
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; errorHash: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, errorHash } = await params;
    await requireProjectPermission(
      auth.user.userId,
      projectId,
      Permission.PROJECT_MANAGE_INTEGRATIONS
    );

    const body = await req.json();
    const { provider, title, description } = body as {
      provider?: string;
      title?: string;
      description?: string;
    };

    if (!provider) {
      return NextResponse.json(
        { error: "provider is required" },
        { status: 400 }
      );
    }

    const integration = await prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider,
        },
      },
    });

    if (!integration || !integration.enabled) {
      return NextResponse.json(
        { error: `${provider} integration not configured or disabled` },
        { status: 400 }
      );
    }

    const decodedHash = decodeURIComponent(errorHash);
    const summary = (title as string)?.trim() || `Error: ${decodedHash.slice(0, 32)}`;
    const desc = (description as string)?.trim() || `Linked from Replayly error group: ${decodedHash}`;

    let externalIssue: { key: string; id: string };
    let externalUrl: string;

    if (provider === "jira") {
      const config = integration.config as unknown as JiraIntegrationConfig;
      if (
        !config?.domain ||
        !config?.email ||
        !config?.apiToken ||
        !config?.projectKey
      ) {
        return NextResponse.json(
          { error: "Jira integration missing config (domain, email, apiToken, projectKey)" },
          { status: 400 }
        );
      }
      const jiraClient = new JiraClient(config);
      externalIssue = await jiraClient.createIssue({
        summary,
        description: desc,
        issueType: "Bug",
        projectKey: config.projectKey,
        labels: ["replayly"],
      });
      externalUrl = `https://${config.domain}/browse/${externalIssue.key}`;
    } else {
      return NextResponse.json(
        { error: `Provider ${provider} not supported` },
        { status: 400 }
      );
    }

    const issueLink = await prisma.issueLink.create({
      data: {
        projectId,
        errorHash: decodedHash,
        provider,
        externalId: externalIssue.key,
        externalUrl,
        createdBy: auth.user.userId,
      },
    });

    await logActivity({
      projectId,
      userId: auth.user.userId,
      type: "ISSUE_LINKED",
      metadata: {
        errorHash: decodedHash,
        provider,
        externalId: externalIssue.key,
      },
    });

    return NextResponse.json({ issueLink, externalIssue: { key: externalIssue.key, id: externalIssue.id } });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create issue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
