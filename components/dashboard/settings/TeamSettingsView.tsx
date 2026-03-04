"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  inviter: { name: string | null; email: string };
}

export function TeamSettingsView({ projectId }: { projectId: string }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const projRes = await fetch(`/api/projects/${projectId}`);
        const projData = await projRes.json();
        if (!projRes.ok || !projData.project?.organizationId) {
          if (!cancelled) setError("Could not load project");
          return;
        }
        const oid = projData.project.organizationId;
        if (!cancelled) setOrgId(oid);

        const [membersRes, invRes] = await Promise.all([
          fetch(`/api/organizations/${oid}/members`),
          fetch(`/api/organizations/${oid}/invitations`),
        ]);

        if (membersRes.ok) {
          const d = await membersRes.json();
          if (!cancelled) setMembers(d.members ?? []);
        } else if (membersRes.status === 403 && !cancelled) {
          setError("You don’t have permission to manage team members.");
        }
        if (invRes.ok) {
          const d = await invRes.json();
          if (!cancelled) setInvitations(d.invitations ?? []);
        }
      } catch {
        if (!cancelled) setError("Failed to load team");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInvitations((prev) => [
          {
            id: data.invitation.id,
            email: data.invitation.email,
            role: data.invitation.role,
            expiresAt: data.invitation.expiresAt,
            inviter: data.invitation.inviter ?? { name: null, email: "" },
          },
          ...prev,
        ]);
        setInviteEmail("");
      } else {
        setError(data.error ?? "Failed to send invitation");
      }
    } catch {
      setError("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleResendInvite(invitationId: string) {
    if (!orgId) return;
    setResendingId(invitationId);
    setError(null);
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/invitations/${invitationId}/resend`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok && data.invitation) {
        setInvitations((prev) =>
          prev.map((inv) =>
            inv.id === invitationId
              ? { ...inv, expiresAt: data.invitation.expiresAt }
              : inv
          )
        );
      } else {
        setError(data.error ?? "Failed to resend invitation");
      }
    } catch {
      setError("Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !orgId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--red)]">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (error && members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--red)]">{error}</p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Only organization admins and owners can manage team members.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team members</CardTitle>
        <p className="text-sm text-[var(--muted)]">
          Organization members have access to all projects in this organization.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
            >
              <div>
                <span className="font-medium">
                  {m.user.name ?? m.user.email}
                </span>
                {m.user.name && (
                  <span className="text-sm text-[var(--muted)] ml-2">
                    {m.user.email}
                  </span>
                )}
              </div>
              <span className="text-sm text-[var(--muted)] capitalize">
                {m.role.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>

        <div>
          <h3 className="text-sm font-medium mb-2">Pending invitations</h3>
          {invitations.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">None</p>
          ) : (
            <ul className="space-y-2">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{inv.email}</span>
                    <span className="text-[var(--muted)] shrink-0">{inv.role}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleResendInvite(inv.id)}
                    disabled={resendingId === inv.id}
                  >
                    {resendingId === inv.id ? "Sending…" : "Resend"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleInvite} className="space-y-4 pt-4 border-t border-[var(--border)]">
          <h3 className="text-sm font-medium">Invite by email</h3>
          {error && (
            <p className="text-sm text-[var(--red)]">{error}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
              />
            </div>
            <div className="w-[140px] space-y-1">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                {inviting ? "Sending..." : "Send invite"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
