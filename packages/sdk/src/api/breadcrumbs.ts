import type { ReplaylyClient } from "../core/client";

export type BreadcrumbLevel = "debug" | "info" | "warning" | "error";

export interface Breadcrumb {
  message: string;
  level: BreadcrumbLevel;
  category?: string;
  timestamp: Date;
  metadata?: unknown;
}

const MAX_BREADCRUMBS = 100;

export class Breadcrumbs {
  constructor(private client: ReplaylyClient) {}

  add(
    message: string,
    options?: { level?: BreadcrumbLevel; category?: string; metadata?: unknown }
  ): void {
    const context = this.client.getContext();
    if (!context) return;

    if (!context.breadcrumbs) context.breadcrumbs = [];

    const breadcrumb: Breadcrumb = {
      message,
      level: options?.level ?? "info",
      category: options?.category,
      timestamp: new Date(),
      metadata: options?.metadata,
    };

    context.breadcrumbs.push(breadcrumb);
    if (context.breadcrumbs.length > MAX_BREADCRUMBS) {
      context.breadcrumbs = context.breadcrumbs.slice(-MAX_BREADCRUMBS);
    }
  }

  debug(message: string, metadata?: unknown): void {
    this.add(message, { level: "debug", metadata });
  }

  info(message: string, metadata?: unknown): void {
    this.add(message, { level: "info", metadata });
  }

  warning(message: string, metadata?: unknown): void {
    this.add(message, { level: "warning", metadata });
  }

  error(message: string, metadata?: unknown): void {
    this.add(message, { level: "error", metadata });
  }

  navigation(from: string, to: string): void {
    this.add(`Navigation: ${from} → ${to}`, {
      level: "info",
      category: "navigation",
      metadata: { from, to },
    });
  }

  http(method: string, url: string, statusCode: number): void {
    this.add(`${method} ${url} → ${statusCode}`, {
      level: statusCode >= 400 ? "error" : "info",
      category: "http",
      metadata: { method, url, statusCode },
    });
  }

  userAction(action: string, target?: string): void {
    this.add(`User ${action}${target ? ` on ${target}` : ""}`, {
      level: "info",
      category: "user",
      metadata: { action, target },
    });
  }
}
