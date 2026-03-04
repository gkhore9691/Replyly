export interface SlackNotification {
  webhookUrl: string;
  message: string;
  projectName: string;
  ruleName: string;
  alertUrl: string;
}

export async function sendSlackNotification(notification: SlackNotification): Promise<void> {
  const res = await fetch(notification.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Alert triggered", emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Project:*\n${notification.projectName}` },
            { type: "mrkdwn", text: `*Rule:*\n${notification.ruleName}` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Message:*\n${notification.message}` },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View alert details", emoji: true },
              url: notification.alertUrl,
              style: "primary",
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`);
  }
}
