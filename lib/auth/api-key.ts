import crypto from "crypto";
import { prisma } from "@/lib/db/postgres";

export interface ApiKeyData {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
}

const apiKeyCache = new Map<
  string,
  { data: ApiKeyData; expiresAt: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function validateApiKey(
  apiKey: string
): Promise<ApiKeyData | null> {
  const cached = apiKeyCache.get(apiKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      project: {
        select: { id: true, organizationId: true },
      },
    },
  });

  if (!apiKeyRecord) return null;
  if (
    apiKeyRecord.expiresAt &&
    apiKeyRecord.expiresAt.getTime() < Date.now()
  ) {
    return null;
  }

  const data: ApiKeyData = {
    id: apiKeyRecord.id,
    projectId: apiKeyRecord.projectId,
    organizationId: apiKeyRecord.project.organizationId,
    name: apiKeyRecord.name,
  };

  apiKeyCache.set(apiKey, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return data;
}

export async function updateApiKeyLastUsed(apiKeyId: string): Promise<void> {
  await prisma.apiKey
    .update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Non-blocking; ignore errors
    });
}

export function generateApiKey(environment: "live" | "test"): {
  key: string;
  hash: string;
  prefix: string;
} {
  const randomPart = crypto.randomBytes(24).toString("base64url");
  const key = `rply_${environment}_${randomPart}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 12);
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
