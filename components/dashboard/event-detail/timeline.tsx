import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineProps {
  event: {
    timestamp?: string;
    durationMs?: number;
    method?: string;
    route?: string;
    statusCode?: number;
  };
}

export function Timeline({ event }: TimelineProps) {
  const start = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString()
    : "—";
  const duration = event.durationMs ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Start</span>
            <span className="text-sm font-medium">{start}</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Duration</span>
            <span className="text-sm font-medium">{duration}ms</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Request</span>
            <span className="text-sm font-medium">
              {event.method} {event.route}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Response</span>
            <span className="text-sm font-medium">{event.statusCode}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
