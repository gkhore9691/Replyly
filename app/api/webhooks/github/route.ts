import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/integrations/github/verify";
import {
  handleDeploymentEvent,
  handleDeploymentStatusEvent,
  handlePushEvent,
} from "@/lib/integrations/github/handlers";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-hub-signature-256");
    const body = await req.text();

    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body) as Record<string, unknown>;
    const eventType = req.headers.get("x-github-event");

    switch (eventType) {
      case "deployment":
        await handleDeploymentEvent(event);
        break;
      case "deployment_status":
        await handleDeploymentStatusEvent(event as Parameters<typeof handleDeploymentStatusEvent>[0]);
        break;
      case "push":
        await handlePushEvent(event as Parameters<typeof handlePushEvent>[0]);
        break;
      default:
        break;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
