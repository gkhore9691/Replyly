"use client";

import { useEffect, useState } from "react";
import { ErrorGroupCard } from "./error-group-card";
import { Loader2 } from "lucide-react";

interface ErrorGroup {
  errorHash: string;
  count: number;
  lastSeen: string;
  firstSeen?: string;
  errorMessage?: string;
  route?: string;
  sampleEventId?: string;
}

interface ErrorGroupListProps {
  projectId: string;
}

export function ErrorGroupList({ projectId }: ErrorGroupListProps) {
  const [groups, setGroups] = useState<ErrorGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/error-groups`)
      .then((res) => res.json())
      .then((data) => setGroups(data.errorGroups ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No error groups yet. Errors are grouped by hash when they occur.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <ErrorGroupCard
          key={group.errorHash}
          projectId={projectId}
          errorHash={group.errorHash}
          count={group.count}
          lastSeen={group.lastSeen}
          firstSeen={group.firstSeen}
          errorMessage={group.errorMessage}
          route={group.route}
          sampleEventId={group.sampleEventId}
        />
      ))}
    </div>
  );
}
