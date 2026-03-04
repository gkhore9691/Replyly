export interface PagerDutyNotification {
  integrationKey: string;
  message: string;
  severity: "critical" | "error" | "warning" | "info";
  projectName: string;
  ruleName: string;
  alertUrl: string;
}

export async function sendPagerDutyNotification(notification: PagerDutyNotification): Promise<void> {
  const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_key: notification.integrationKey,
      event_action: "trigger",
      payload: {
        summary: `[Replayly] ${notification.ruleName}`,
        severity: notification.severity,
        source: notification.projectName,
        custom_details: {
          message: notification.message,
          alert_url: notification.alertUrl,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PagerDuty failed: ${res.status} ${text}`);
  }
}
