import { redis } from "@/lib/db/redis";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/postgres";

const PREFIX = "replayly:device:";
const CODE_TTL = 900; // 15 minutes
const APPROVED_TTL = 300; // 5 minutes for CLI to poll

function deviceKey(deviceCode: string): string {
  return `${PREFIX}code:${deviceCode}`;
}

function userCodeKey(userCode: string): string {
  return `${PREFIX}user:${userCode}`;
}

export interface DeviceCodePayload {
  status: "pending" | "approved";
  token?: string;
}

export async function generateDeviceCode(): Promise<{
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}> {
  const deviceCode = crypto.randomUUID();
  const userCode = generateUserCode();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await redis.setex(
    deviceKey(deviceCode),
    CODE_TTL,
    JSON.stringify({ status: "pending" } as DeviceCodePayload)
  );
  await redis.setex(userCodeKey(userCode), CODE_TTL, deviceCode);

  return {
    deviceCode,
    userCode,
    verificationUri: `${appUrl}/device?code=${userCode}`,
    expiresIn: CODE_TTL,
  };
}

function generateUserCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export type CheckDeviceCodeResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "approved"; token: string };

export async function checkDeviceCode(
  deviceCode: string
): Promise<CheckDeviceCodeResult> {
  const raw = await redis.get(deviceKey(deviceCode));
  if (!raw) {
    return { status: "expired" };
  }
  const payload = JSON.parse(raw) as DeviceCodePayload;
  if (payload.status === "approved" && payload.token) {
    return { status: "approved", token: payload.token };
  }
  return { status: "pending" };
}

export async function getDeviceCodeByUserCode(
  userCode: string
): Promise<string | null> {
  return redis.get(userCodeKey(userCode));
}

export async function approveDeviceCode(
  deviceCode: string,
  userId: string
): Promise<string> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const organizationIds = memberships.map((m) => m.organizationId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    throw new Error("User not found");
  }
  const token = signToken({
    userId,
    email: user.email,
    organizationIds,
  });
  await redis.setex(
    deviceKey(deviceCode),
    APPROVED_TTL,
    JSON.stringify({ status: "approved", token } as DeviceCodePayload)
  );
  return token;
}
