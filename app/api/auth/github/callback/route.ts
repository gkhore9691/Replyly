import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/postgres";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { encryptToken } from "@/lib/integrations/github/token";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const errorUrl = `${baseUrl}/error?message=Invalid callback`;
  const failUrl = `${baseUrl}/error?message=GitHub connection failed`;

  if (!code || !state) {
    return NextResponse.redirect(errorUrl);
  }

  try {
    const decoded = Buffer.from(state, "base64").toString("utf8");
    const { userId, projectId } = JSON.parse(decoded) as {
      userId?: string;
      projectId?: string;
    };
    if (!userId || !projectId) {
      return NextResponse.redirect(errorUrl);
    }

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) {
      return NextResponse.redirect(`${baseUrl}/error?message=Forbidden`);
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(failUrl);
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(failUrl);
    }
    const githubUser = (await userRes.json()) as { id?: number; login?: string };

    await prisma.gitHubIntegration.upsert({
      where: { projectId },
      create: {
        projectId,
        userId,
        accessToken: encryptToken(tokenData.access_token),
        githubUserId: githubUser.id ?? 0,
        githubUsername: githubUser.login ?? "unknown",
      },
      update: {
        accessToken: encryptToken(tokenData.access_token),
        githubUserId: githubUser.id ?? 0,
        githubUsername: githubUser.login ?? "unknown",
      },
    });

    return NextResponse.redirect(
      `${baseUrl}/dashboard/${projectId}/settings?github=connected`
    );
  } catch {
    return NextResponse.redirect(failUrl);
  }
}
