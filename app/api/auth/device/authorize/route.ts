import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import {
  getDeviceCodeByUserCode,
  approveDeviceCode,
  checkDeviceCode,
} from "@/lib/auth/device-flow";

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const userCode = (body?.userCode as string)?.trim();

    if (!userCode) {
      return NextResponse.json(
        { error: "userCode is required" },
        { status: 400 }
      );
    }

    const deviceCode = await getDeviceCodeByUserCode(userCode);
    if (!deviceCode) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 }
      );
    }

    const existing = await checkDeviceCode(deviceCode);
    if (existing.status === "approved") {
      return NextResponse.json({ success: true, message: "Already authorized" });
    }

    await approveDeviceCode(deviceCode, auth.user.userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
