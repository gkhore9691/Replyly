import type { ReplaylyClient } from "../../core/client";

function captureAxiosCall(
  client: ReplaylyClient,
  config: { _replaylyStartTime?: number; method?: string; url?: string },
  response: { status?: number } | null,
  error: Error | null
): void {
  const durationMs = Date.now() - (config._replaylyStartTime ?? Date.now());
  client.captureOperation("external_call", {
    method: (config.method ?? "GET").toUpperCase(),
    url: config.url,
    statusCode: response?.status,
    durationMs,
    success: !error,
    error: error?.message,
  });
}

export function instrument(client: ReplaylyClient): void {
  try {
    const axios = require("axios");
    axios.interceptors.request.use((config: { _replaylyStartTime?: number }) => {
      config._replaylyStartTime = Date.now();
      return config;
    });
    axios.interceptors.response.use(
      (response: { config: unknown }) => {
        captureAxiosCall(client, response.config as Parameters<typeof captureAxiosCall>[1], response as unknown as { status?: number }, null);
        return response;
      },
      (error: { config?: unknown; response?: { status?: number }; message?: string }) => {
        captureAxiosCall(
          client,
          (error.config ?? {}) as Parameters<typeof captureAxiosCall>[1],
          error.response ?? null,
          error instanceof Error ? error : new Error(error.message ?? String(error))
        );
        return Promise.reject(error);
      }
    );
  } catch {
    // axios not installed
  }
}
