import { generateApiKey } from "@/lib/auth/api-key";

jest.mock("@/lib/db/postgres", () => ({
  prisma: {
    apiKey: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const prisma = require("@/lib/db/postgres").prisma;

describe("Ingestion API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateApiKey", () => {
    it("should generate key with correct prefix for live", () => {
      const result = generateApiKey("live");
      expect(result.key).toMatch(/^rply_live_/);
      expect(result.hash).toBeDefined();
      expect(result.prefix).toBe(result.key.substring(0, 12));
    });

    it("should generate key with correct prefix for test", () => {
      const result = generateApiKey("test");
      expect(result.key).toMatch(/^rply_test_/);
    });

    it("should produce deterministic hash from key", () => {
      const crypto = require("crypto");
      const result = generateApiKey("live");
      const expectedHash = crypto
        .createHash("sha256")
        .update(result.key)
        .digest("hex");
      expect(result.hash).toBe(expectedHash);
    });
  });

  describe("validateApiKey", () => {
    const { validateApiKey } = require("@/lib/auth/api-key");

    it("should return null for invalid key when no record found", async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await validateApiKey("rply_live_invalidkey");

      expect(result).toBeNull();
    });

    it("should return project data when key is valid and not expired", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key_1",
        projectId: "proj_1",
        expiresAt: null,
        project: { id: "proj_1", organizationId: "org_1" },
      });

      const result = await validateApiKey("rply_live_testkey123");
      expect(result).not.toBeNull();
      expect(result?.projectId).toBe("proj_1");
      expect(result?.organizationId).toBe("org_1");
    });

    it("should return null when key is expired", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key_1",
        projectId: "proj_1",
        expiresAt: new Date(Date.now() - 86400000),
        project: { id: "proj_1", organizationId: "org_1" },
      });

      const result = await validateApiKey("rply_live_expiredkey");
      expect(result).toBeNull();
    });
  });
});
