import type { ReplaylyClient } from "../core/client";
import type { RequestContext } from "../core/types";

export interface UserContext {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class UserContextManager {
  constructor(private client: ReplaylyClient) {}

  setUser(user: UserContext): void {
    const context = this.client.getContext();
    if (context) {
      context.user = user as RequestContext["user"];
    }
  }

  updateUser(updates: Partial<UserContext>): void {
    const context = this.client.getContext();
    if (context?.user) {
      context.user = { ...context.user, ...updates };
    }
  }

  clearUser(): void {
    const context = this.client.getContext();
    if (context) {
      context.user = undefined;
    }
  }

  getUser(): UserContext | undefined {
    const context = this.client.getContext();
    return context?.user as UserContext | undefined;
  }
}
