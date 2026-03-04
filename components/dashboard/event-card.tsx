import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle } from "lucide-react";
import type { EventListItem } from "./event-list";

interface EventCardProps {
  event: EventListItem;
  projectId: string;
}

export function EventCard({ event, projectId }: EventCardProps) {
  return (
    <Link href={`/dashboard/${projectId}/events/${event.requestId}`}>
      <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono">
                  {event.method}
                </Badge>
                <span className="font-medium truncate">{event.route}</span>
                <Badge variant={event.isError ? "destructive" : "default"}>
                  {event.statusCode}
                </Badge>
              </div>
              {event.errorMessage && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{event.errorMessage}</span>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {new Date(event.timestamp).toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{event.durationMs}ms</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
