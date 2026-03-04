import type { ReplaylyClient } from "../../core/client";

export function instrument(client: ReplaylyClient): void {
  try {
    const globalFetch = globalThis.fetch as (input: unknown, init?: unknown) => Promise<{ status: number; ok: boolean }>;
    if (typeof globalFetch !== "function") return;

    (globalThis as unknown as { fetch: (input: unknown, init?: unknown) => Promise<unknown> }).fetch = async function (
      input: unknown,
      init?: unknown
    ): Promise<unknown> {
      const start = Date.now();
      let url = "";
      let method = "GET";
      if (typeof input === "string") url = input;
      else if (input && typeof input === "object" && "href" in input) url = String((input as { href: string }).href);
      else if (input && typeof input === "object" && "url" in input) url = String((input as { url: string }).url);
      if (init && typeof init === "object" && "method" in init) method = String((init as { method?: string }).method ?? "GET");

      try {
        const response = await globalFetch(input, init) as { status: number; ok: boolean };
        client.captureOperation("external_call", {
          method,
          url,
          statusCode: response.status,
          durationMs: Date.now() - start,
          success: response.ok,
        });
        return response;
      } catch (err) {
        client.captureOperation("external_call", {
          method,
          url,
          durationMs: Date.now() - start,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };
  } catch {
    // ignore
  }
}
