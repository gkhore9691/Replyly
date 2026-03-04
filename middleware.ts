import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/login", "/signup"];
const authPaths = ["/login", "/signup"];

export function middleware(req: NextRequest) {
  const token = req.cookies.get("replayly_token")?.value;
  const isAuthenticated = Boolean(token);
  const path = req.nextUrl.pathname;
  const isPublic = publicPaths.includes(path) || path.startsWith("/api/");
  const isAuthPage = authPaths.some((p) => path.startsWith(p));

  if (path.startsWith("/dashboard") && !isAuthenticated) {
    const login = new URL("/login", req.url);
    login.searchParams.set("from", path);
    return NextResponse.redirect(login);
  }

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
