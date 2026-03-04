import { NextResponse } from "next/server";
import { generateDeviceCode } from "@/lib/auth/device-flow";

export async function POST() {
  try {
    const { deviceCode, userCode, verificationUri, expiresIn } =
      await generateDeviceCode();

    return NextResponse.json({
      deviceCode,
      userCode,
      verificationUri,
      expiresIn,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
