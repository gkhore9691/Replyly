// @ts-nocheck
import { Injectable, Inject, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { ReplaylyClient } from "@replayly/sdk";
import type { RequestContext } from "@replayly/sdk";

@Injectable({ scope: Scope.REQUEST })
export class ReplaylyService {
  constructor(
    @Inject("REPLAYLY_CLIENT")
    private readonly client: ReplaylyClient,
    @Inject(REQUEST)
    private readonly request: Record<string, unknown>
  ) {}

  getContext(): RequestContext | undefined {
    return this.request.replaylyContext as RequestContext | undefined;
  }

  async trackOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.client.trackOperation(name, fn);
  }

  addBreadcrumb(message: string, metadata?: unknown): void {
    this.client.addBreadcrumb(message, { metadata });
  }

  setUser(user: { id: string; email?: string; name?: string }): void {
    this.client.setUser(user);
  }
}
