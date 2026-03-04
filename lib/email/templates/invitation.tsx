import * as React from "react";

export interface InvitationEmailProps {
  inviterName: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
}

export function InvitationEmail({
  inviterName,
  organizationName,
  role,
  acceptUrl,
}: InvitationEmailProps) {
  return (
    <html>
      <head>
        <style>{`
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>You&apos;ve been invited to Replayly</h1>
          </div>
          <div className="content">
            <p>
              <strong>{inviterName}</strong> has invited you to join{" "}
              <strong>{organizationName}</strong> on Replayly as a{" "}
              <strong>{role}</strong>.
            </p>
            <p>
              Replayly is a debugging platform that helps teams capture and
              replay production issues.
            </p>
            <a href={acceptUrl} className="button">
              Accept Invitation
            </a>
            <p
              style={{
                marginTop: "16px",
                fontSize: "14px",
                color: "#6b7280",
              }}
            >
              This invitation will expire in 7 days.
            </p>
          </div>
          <div className="footer">
            <p>If you didn&apos;t expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  );
}
