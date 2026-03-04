import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ErrorGroupCardProps {
  projectId: string;
  errorHash: string;
  count: number;
  lastSeen: string;
  firstSeen?: string;
  errorMessage?: string;
  route?: string;
  sampleEventId?: string;
}

export function ErrorGroupCard({
  projectId,
  errorHash,
  count,
  lastSeen,
  errorMessage,
  route,
  sampleEventId,
}: ErrorGroupCardProps) {
  const link = sampleEventId
    ? `/dashboard/${projectId}/events/${sampleEventId}`
    : `/dashboard/${projectId}/errors/${errorHash}`;

  return (
    <Link href={link}>
      <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              {errorMessage && (
                <p className="text-sm font-medium line-clamp-2">
                  {errorMessage}
                </p>
              )}
              {route && (
                <p className="text-xs text-muted-foreground font-mono">
                  {route}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">{count} occurrences</Badge>
                <span className="text-xs text-muted-foreground">
                  Last seen {new Date(lastSeen).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
