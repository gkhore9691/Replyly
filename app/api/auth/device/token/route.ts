import { NextRequest, NextResponse } from "next/server";
import { checkDeviceCode } from "@/lib/auth/device-flow";

const TOKEN_EXPIRES_IN_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const deviceCode = body?.deviceCode as string | undefined;

    if (!deviceCode || typeof deviceCode !== "string") {
      return NextResponse.json(
        { error: "deviceCode is required" },
        { status: 400 }
      );
    }

    const result = await checkDeviceCode(deviceCode);

    if (result.status === "pending") {
      return NextResponse.json(
        { error: "authorization_pending" },
        { status: 428 }
      );
    }

    if (result.status === "expired") {
      return NextResponse.json(
        { error: "expired_token" },
        { status: 400 }
      );
    }

    if (result.status === "approved") {
      return NextResponse.json({
        accessToken: result.token,
        expiresIn: 60 * 60 * 24 * TOKEN_EXPIRES_IN_DAYS,
      });
    }

    return NextResponse.json(
      { error: "invalid_grant" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
