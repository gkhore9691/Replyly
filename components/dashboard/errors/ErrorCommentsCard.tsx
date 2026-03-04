"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
}

export function ErrorCommentsCard({
  projectId,
  errorHash,
}: {
  projectId: string;
  errorHash: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const encodedHash = encodeURIComponent(errorHash);

  async function fetchComments() {
    const res = await fetch(
      `/api/projects/${projectId}/error-groups/${encodedHash}/comments`
    );
    const data = await res.json();
    if (res.ok && data.comments) setComments(data.comments);
    setLoading(false);
  }

  useEffect(() => {
    fetchComments();
  }, [projectId, encodedHash]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/error-groups/${encodedHash}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comments</CardTitle>
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
        <CardTitle className="text-base">Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3 max-h-64 overflow-y-auto">
          {comments.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">No comments yet.</li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">
                    {c.author.name?.[0] ?? c.author.email[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {c.author.name ?? c.author.email}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {formatDistanceToNow(new Date(c.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            className="flex-1 min-h-[80px] rounded-sm border border-[var(--border)] bg-[#111] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-y"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submitting}
          />
          <Button type="submit" size="sm" disabled={submitting || !newComment.trim()}>
            {submitting ? "Posting..." : "Post"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
