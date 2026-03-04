/**
 * Unit tests for GitHub webhook signature verification.
 */
import crypto from "crypto";
import { verifyWebhookSignature } from "@/lib/integrations/github/verify";

describe("verifyWebhookSignature", () => {
  const secret = "test_webhook_secret";

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  it("should return true for valid signature", () => {
    const payload = '{"action":"opened"}';
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");

    expect(verifyWebhookSignature(payload, digest)).toBe(true);
  });

  it("should return false when signature is null", () => {
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("should return false when secret is unset", () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const payload = "{}";
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    expect(verifyWebhookSignature(payload, digest)).toBe(false);
  });

  it("should return false for tampered payload", () => {
    const payload = '{"action":"opened"}';
    const wrongPayload = '{"action":"closed"}';
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");

    expect(verifyWebhookSignature(wrongPayload, digest)).toBe(false);
  });

  it("should return false for wrong signature", () => {
    expect(verifyWebhookSignature("{}", "sha256=wrong")).toBe(false);
  });
});
