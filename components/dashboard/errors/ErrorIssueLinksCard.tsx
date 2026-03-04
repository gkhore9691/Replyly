"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink } from "lucide-react";

interface IssueLink {
  id: string;
  provider: string;
  externalId: string;
  externalUrl: string;
  createdAt: string;
}

export function ErrorIssueLinksCard({
  projectId,
  errorHash,
}: {
  projectId: string;
  errorHash: string;
}) {
  const [links, setLinks] = useState<IssueLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState("jira");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const encodedHash = encodeURIComponent(errorHash);

  async function fetchLinks() {
    const res = await fetch(
      `/api/projects/${projectId}/error-groups/${encodedHash}/issue-links`
    );
    const data = await res.json();
    if (res.ok && data.issueLinks) setLinks(data.issueLinks);
    setLoading(false);
  }

  useEffect(() => {
    fetchLinks();
  }, [projectId, encodedHash]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/error-groups/${encodedHash}/create-issue`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            title: title.trim() || undefined,
            description: description.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.issueLink) {
        setLinks((prev) => [data.issueLink, ...prev]);
        setOpen(false);
        setTitle("");
        setDescription("");
      } else {
        alert(data.error ?? "Failed to create issue");
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-[var(--muted)] text-sm">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linked issues</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {links.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No linked issues.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
                >
                  <span className="capitalize">{link.provider}</span>
                  <span>{link.externalId}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Link to issue tracker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create issue in tracker</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Provider</Label>
                <select
                  className="mt-1 w-full rounded-sm border border-[var(--border)] bg-[#111] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  <option value="jira">Jira</option>
                </select>
              </div>
              <div>
                <Label htmlFor="link-title">Title</Label>
                <Input
                  id="link-title"
                  className="mt-1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Issue summary"
                />
              </div>
              <div>
                <Label htmlFor="link-desc">Description (optional)</Label>
                <textarea
                  id="link-desc"
                  className="mt-1 w-full min-h-[80px] rounded-sm border border-[var(--border)] bg-[#111] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Issue description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create issue"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
