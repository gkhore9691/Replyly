import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailNotification {
  to: string[];
  subject: string;
  message: string;
  projectName: string;
  ruleName: string;
  alertUrl: string;
}

export async function sendEmailNotification(notification: EmailNotification): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Alert triggered</h1>
            <p>${notification.ruleName}</p>
          </div>
          <div class="content">
            <p><strong>Project:</strong> ${notification.projectName}</p>
            <p><strong>Message:</strong> ${notification.message}</p>
            <a href="${notification.alertUrl}" class="button">View alert details</a>
          </div>
          <div class="footer">
            <p>You received this alert because you're subscribed to notifications for this project.</p>
            <p>Manage your notification settings in the Replayly dashboard.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "alerts@replayly.dev",
    to: notification.to,
    subject: `[Replayly Alert] ${notification.subject}`,
    html,
  });
}
