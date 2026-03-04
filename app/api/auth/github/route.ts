import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const state = Buffer.from(
    JSON.stringify({ userId: user.user.userId, projectId })
  ).toString("base64");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID ?? "");
  githubAuthUrl.searchParams.set(
    "redirect_uri",
    `${baseUrl}/api/auth/github/callback`
  );
  githubAuthUrl.searchParams.set("scope", "repo,read:org");
  githubAuthUrl.searchParams.set("state", state);

  return NextResponse.redirect(githubAuthUrl.toString());
}
