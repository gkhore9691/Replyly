"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string | undefined;
  const [invitation, setInvitation] = useState<{
    inviter: { name: string | null; email: string };
    organization: { name: string } | null;
    role: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
      setLoading(false);
      return;
    }
    fetchInvitation();
  }, [token]);

  async function fetchInvitation() {
    if (!token) return;
    try {
      const res = await fetch(`/api/invitations/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Invalid invitation");
        setLoading(false);
        return;
      }

      setInvitation(data.invitation);
    } catch {
      setError("Failed to load invitation");
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvitation() {
    if (!token) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to accept invitation");
        return;
      }

      router.push(`/dashboard?org=${data.organizationId}`);
    } catch {
      setError("Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
        <Card className="p-8 max-w-md w-full">
          <CardContent className="p-0">
            <h1 className="text-2xl font-bold text-[var(--red)] mb-4">
              Invalid Invitation
            </h1>
            <p className="text-[var(--muted)] mb-6">{error}</p>
            <Button onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <Card className="p-8 max-w-md w-full">
        <CardContent className="p-0">
          <h1 className="text-2xl font-bold mb-4">You&apos;ve been invited!</h1>
          <p className="text-[var(--muted)] mb-6">
            <strong>
              {invitation.inviter?.name ?? invitation.inviter?.email}
            </strong>{" "}
            has invited you to join{" "}
            <strong>{invitation.organization?.name ?? "the organization"}</strong>{" "}
            as a <strong>{invitation.role}</strong>.
          </p>
          <Button
            onClick={acceptInvitation}
            disabled={accepting}
            className="w-full"
          >
            {accepting ? "Accepting..." : "Accept Invitation"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
