"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ErrorGroup {
  errorHash: string;
  count: number;
  errorMessage?: string;
  route?: string;
  sampleEventId?: string;
  lastSeen?: string;
}

interface ReleaseErrorGroupListProps {
  errorGroups: ErrorGroup[];
  projectId: string;
}

export function ReleaseErrorGroupList({
  errorGroups,
  projectId,
}: ReleaseErrorGroupListProps) {
  if (errorGroups.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No errors associated with this release.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorGroups.map((group) => {
        const link = group.sampleEventId
          ? `/dashboard/${projectId}/events/${group.sampleEventId}`
          : `/dashboard/${projectId}/errors/${group.errorHash}`;
        return (
          <Link key={group.errorHash} href={link}>
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    {group.errorMessage && (
                      <p className="text-sm font-medium line-clamp-2">
                        {group.errorMessage}
                      </p>
                    )}
                    {group.route && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {group.route}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">
                        {group.count} occurrences
                      </Badge>
                      {group.lastSeen && (
                        <span className="text-xs text-muted-foreground">
                          Last seen{" "}
                          {new Date(group.lastSeen).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
