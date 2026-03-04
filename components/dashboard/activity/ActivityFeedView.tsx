"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

function getActivityMessage(activity: Activity): string {
  switch (activity.type) {
    case "ERROR_ASSIGNED":
      return `assigned error to ${String(activity.metadata.assigneeName ?? "someone")}`;
    case "ERROR_RESOLVED":
      return "resolved an error";
    case "COMMENT_CREATED":
      return "commented on an error";
    case "ISSUE_LINKED":
      return `linked issue to ${String(activity.metadata.provider ?? "tracker")}`;
    case "ALERT_TRIGGERED":
      return "triggered an alert";
    case "RELEASE_DEPLOYED":
      return `deployed release ${String(activity.metadata.version ?? "")}`;
    case "EVENT_VIEWED":
      return "viewed an event";
    case "MEMBER_INVITED":
      return "invited a team member";
    case "MEMBER_JOINED":
      return "joined the project";
    case "SETTINGS_UPDATED":
      return "updated settings";
    default:
      return activity.type.toLowerCase().replace(/_/g, " ");
  }
}

export function ActivityFeedView({ projectId }: { projectId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchActivities() {
      try {
        const res = await fetch(`/api/projects/${projectId}/activity`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load activity");
          return;
        }
        if (!cancelled) setActivities(data.activities ?? []);
      } catch {
        if (!cancelled) setError("Failed to load activity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchActivities();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="text-[var(--muted)] py-8">Loading activity...</div>
    );
  }

  if (error) {
    return (
      <div className="text-[var(--red)] py-8">{error}</div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-[var(--muted)] py-8">
        No activity yet. Assign errors, add comments, or link issues to see activity here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <Card key={activity.id} className="p-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="text-sm">
                {activity.user.name?.[0] ?? activity.user.email[0] ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {activity.user.name ?? activity.user.email}
                </span>
                <span className="text-[var(--muted)]">
                  {getActivityMessage(activity)}
                </span>
              </div>
              <div className="text-sm text-[var(--muted)] mt-1">
                {formatDistanceToNow(new Date(activity.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
