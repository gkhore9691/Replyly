export interface DiscordNotification {
  webhookUrl: string;
  message: string;
  projectName: string;
  ruleName: string;
  alertUrl: string;
}

export async function sendDiscordNotification(notification: DiscordNotification): Promise<void> {
  const res = await fetch(notification.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "Alert triggered",
          color: 15548997,
          fields: [
            { name: "Project", value: notification.projectName, inline: true },
            { name: "Rule", value: notification.ruleName, inline: true },
            { name: "Message", value: notification.message, inline: false },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "View alert details",
              url: notification.alertUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status}`);
  }
}
