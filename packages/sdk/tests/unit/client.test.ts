import { ReplaylyClient } from "../../src/core/client";

describe("ReplaylyClient", () => {
  let client: ReplaylyClient;

  beforeEach(() => {
    client = new ReplaylyClient({
      apiKey: "test_key",
      environment: "test",
    });
  });

  describe("createContext", () => {
    it("should create context with request data", () => {
      const req = {
        method: "GET",
        url: "/api/users",
        headers: { "content-type": "application/json" },
        query: { page: "1" },
        body: null,
      };

      const context = client.createContext(req);

      expect(context.method).toBe("GET");
      expect(context.url).toBe("/api/users");
      expect(context.requestId).toBeDefined();
      expect(context.requestId).toMatch(/^req_/);
    });

    it("should mask sensitive headers", () => {
      const req = {
        method: "POST",
        url: "/api/auth",
        headers: {
          authorization: "Bearer secret_token",
          "content-type": "application/json",
        },
        body: { password: "secret123" },
      };

      const context = client.createContext(req);

      expect(context.headers.authorization).not.toBe("Bearer secret_token");
      expect(context.headers.authorization).toContain("***");
    });

    it("should include metadata environment and optional gitCommitSha", () => {
      const context = client.createContext({
        method: "GET",
        url: "/test",
        headers: {},
      });
      expect(context.metadata.environment).toBe("test");
      expect(context.metadata).toHaveProperty("gitCommitSha");
    });
  });

  describe("runInContext", () => {
    it("should maintain context across sync operations", () => {
      const context = client.createContext({
        method: "GET",
        url: "/test",
        headers: {},
      });

      const result = client.runInContext(context, () => {
        return client.getContext();
      });

      expect(result).toBe(context);
    });

    it("should maintain context across async operations", async () => {
      const context = client.createContext({
        method: "GET",
        url: "/test",
        headers: {},
      });

      const result = await client.runInContext(context, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return client.getContext();
      });

      expect(result).toBe(context);
    });
  });
});
