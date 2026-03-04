interface BuiltRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
}

interface EventPayload {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
}

export class RequestBuilder {
  private event: { fullPayload?: EventPayload };

  constructor(event: { fullPayload?: EventPayload }) {
    this.event = event;
  }

  build(): BuiltRequest {
    const payload = this.event.fullPayload ?? {};
    const url = payload.url ?? "/";
    const parsed = new URL(url, "http://localhost");

    const headers = this.filterHeaders(payload.headers ?? {});

    return {
      method: (payload.method ?? "GET").toUpperCase(),
      path: parsed.pathname + parsed.search,
      headers,
      query: payload.query ?? {},
      body: payload.body,
    };
  }

  private filterHeaders(
    headers: Record<string, string>
  ): Record<string, string> {
    const filtered: Record<string, string> = {};
    const excludeHeaders = [
      "host",
      "connection",
      "content-length",
      "transfer-encoding",
      "x-forwarded-for",
      "x-forwarded-proto",
      "x-real-ip",
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        filtered[key] = value;
      }
    }

    return filtered;
  }
}
