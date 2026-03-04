import { getPubSub, PubSubMessage } from "./pubsub";

export interface Subscription {
  id: string;
  projectId: string;
  userId: string;
  filters?: {
    eventTypes?: string[];
    routes?: string[];
    statusCodes?: number[];
    errorOnly?: boolean;
  };
  callback: (message: PubSubMessage) => void;
}

type Handler = (message: PubSubMessage) => void;

export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private handlers: Map<string, Handler> = new Map();
  private pubsub = getPubSub();

  async subscribe(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, subscription);
    const channel = `project:${subscription.projectId}`;
    const handler: Handler = (message: PubSubMessage) => {
      if (this.shouldSendMessage(subscription, message)) {
        subscription.callback(message);
      }
    };
    this.handlers.set(subscription.id, handler);
    await this.pubsub.subscribe(channel, handler);
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    const handler = this.handlers.get(subscriptionId);
    if (subscription && handler) {
      const channel = `project:${subscription.projectId}`;
      await this.pubsub.unsubscribe(channel, handler);
      this.subscriptions.delete(subscriptionId);
      this.handlers.delete(subscriptionId);
    }
  }

  private shouldSendMessage(subscription: Subscription, message: PubSubMessage): boolean {
    const { filters } = subscription;
    if (!filters) return true;

    if (filters.eventTypes && !filters.eventTypes.includes(message.type)) {
      return false;
    }

    if (filters.errorOnly && message.type !== "error") {
      return false;
    }

    const route = message.data?.route as string | undefined;
    if (filters.routes && route) {
      if (!filters.routes.some((r) => route.includes(r))) {
        return false;
      }
    }

    const statusCode = message.data?.statusCode as number | undefined;
    if (filters.statusCodes && statusCode !== undefined) {
      if (!filters.statusCodes.includes(statusCode)) {
        return false;
      }
    }

    return true;
  }

  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  getAllSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }
}
