export interface WebhookNotification {
  url: string;
  message: string;
  projectName: string;
  ruleName: string;
  alertUrl: string;
  alertHistoryId?: string;
  ruleId?: string;
}

export async function sendWebhookNotification(notification: WebhookNotification): Promise<void> {
  const body = {
    projectName: notification.projectName,
    ruleName: notification.ruleName,
    message: notification.message,
    alertUrl: notification.alertUrl,
    alertHistoryId: notification.alertHistoryId,
    ruleId: notification.ruleId,
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(notification.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Webhook failed: ${res.status}`);
  }
}
