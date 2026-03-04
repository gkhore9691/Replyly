import crypto from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(digest)) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(digest, "utf8")
  );
}
