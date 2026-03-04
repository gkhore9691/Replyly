import "./load-env";

import { Worker } from "bullmq";
import { prisma } from "../../lib/db/postgres";
import { sendEmailNotification } from "../../lib/alerts/channels/email";
import { sendSlackNotification } from "../../lib/alerts/channels/slack";
import { sendDiscordNotification } from "../../lib/alerts/channels/discord";
import { sendPagerDutyNotification } from "../../lib/alerts/channels/pagerduty";
import { sendWebhookNotification } from "../../lib/alerts/channels/webhook";
import { getAlertRedisConnection } from "../../lib/queue/alert-queue";

const connection = getAlertRedisConnection();

interface SendNotificationJob {
  alertHistoryId: string;
  ruleId: string;
  channelId: string;
  message: string;
  projectName: string;
  ruleName: string;
  alertUrl: string;
}

const worker = new Worker<SendNotificationJob>(
  "alerts",
  async (job) => {
    if (job.name !== "send-notification") return;

    const { alertHistoryId, channelId, message, projectName, ruleName, alertUrl, ruleId } = job.data;

    const channel = await prisma.alertChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const config = channel.config as Record<string, unknown>;

    switch (channel.type) {
      case "email": {
        const to = config.recipients as string[];
        if (!to?.length) throw new Error("Email channel missing recipients");
        await sendEmailNotification({
          to,
          subject: ruleName,
          message,
          projectName,
          ruleName,
          alertUrl,
        });
        break;
      }
      case "slack": {
        const webhookUrl = config.webhookUrl as string;
        if (!webhookUrl) throw new Error("Slack channel missing webhookUrl");
        await sendSlackNotification({
          webhookUrl,
          message,
          projectName,
          ruleName,
          alertUrl,
        });
        break;
      }
      case "discord": {
        const discordWebhookUrl = config.webhookUrl as string;
        if (!discordWebhookUrl) throw new Error("Discord channel missing webhookUrl");
        await sendDiscordNotification({
          webhookUrl: discordWebhookUrl,
          message,
          projectName,
          ruleName,
          alertUrl,
        });
        break;
      }
      case "pagerduty": {
        const integrationKey = config.integrationKey as string;
        if (!integrationKey) throw new Error("PagerDuty channel missing integrationKey");
        await sendPagerDutyNotification({
          integrationKey,
          message,
          severity: "error",
          projectName,
          ruleName,
          alertUrl,
        });
        break;
      }
      case "webhook": {
        const url = config.url as string;
        if (!url) throw new Error("Webhook channel missing url");
        await sendWebhookNotification({
          url,
          message,
          projectName,
          ruleName,
          alertUrl,
          alertHistoryId,
          ruleId,
        });
        break;
      }
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }

    await prisma.alertHistory.update({
      where: { id: alertHistoryId },
      data: { notificationsSent: { increment: 1 } },
    });
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: connection as any,
    concurrency: 5,
  }
);

worker.on("failed", async (job, err) => {
  if (job?.name === "send-notification" && job?.data?.alertHistoryId) {
    await prisma.alertHistory.update({
      where: { id: job.data.alertHistoryId },
      data: { notificationsFailed: { increment: 1 } },
    }).catch(() => {});
  }
  console.error("[Notification delivery] Job failed", job?.id, err?.message);
});

console.log("[Notification delivery] Started");
