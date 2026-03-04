import { NextRequest } from "next/server";
import { getAuthToken } from "./session";
import { verifyToken, type JWTPayload } from "./jwt";

export interface AuthUser {
  userId: string;
  email: string;
  organizationIds: string[];
}

export async function verifyAuth(
  req: NextRequest
): Promise<{ user: AuthUser; payload: JWTPayload } | null> {
  const token =
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    (await getAuthToken());

  if (!token) {
    return null;
  }

  try {
    const payload = verifyToken(token);
    return {
      user: {
        userId: payload.userId,
        email: payload.email,
        organizationIds: payload.organizationIds,
      },
      payload,
    };
  } catch {
    return null;
  }
}

export async function getSessionToken(): Promise<string | undefined> {
  return getAuthToken();
}
