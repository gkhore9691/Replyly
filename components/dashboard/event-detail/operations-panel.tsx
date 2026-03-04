import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Globe, Layers } from "lucide-react";

interface OpItem {
  type?: string;
  command?: string;
  method?: string;
  query?: string;
  url?: string;
  durationMs?: number;
  success?: boolean;
  timestamp?: number;
}

interface OperationsPanelProps {
  operations?: {
    dbQueries?: unknown[];
    externalCalls?: unknown[];
    redisOps?: unknown[];
  };
}

export function OperationsPanel({ operations }: OperationsPanelProps) {
  const raw = operations ?? {};
  const dbQueries = Array.isArray(raw.dbQueries) ? raw.dbQueries : [];
  const externalCalls = Array.isArray(raw.externalCalls) ? raw.externalCalls : [];
  const redisOps = Array.isArray(raw.redisOps) ? raw.redisOps : [];

  const allOps: OpItem[] = [
    ...dbQueries.map((op) => ({ ...(op as OpItem), type: "db" })),
    ...externalCalls.map((op) => ({ ...(op as OpItem), type: "external" })),
    ...redisOps.map((op) => ({ ...(op as OpItem), type: "redis" })),
  ].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  if (allOps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operations (0)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No database, HTTP, or Redis operations captured for this request.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operations ({allOps.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allOps.map((op, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="mt-1">
                {op.type === "db" && <Database className="h-4 w-4" />}
                {op.type === "external" && <Globe className="h-4 w-4" />}
                {op.type === "redis" && <Layers className="h-4 w-4" />}
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{op.type}</Badge>
                  {op.command != null && (
                    <span className="font-mono text-sm">{String(op.command)}</span>
                  )}
                  {op.method != null && (
                    <span className="font-mono text-sm">{String(op.method)}</span>
                  )}
                </div>
                {op.query != null && (
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {String(op.query)}
                  </pre>
                )}
                {op.url != null && (
                  <p className="text-sm text-muted-foreground break-all">
                    {String(op.url)}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {op.durationMs != null && <span>{op.durationMs}ms</span>}
                  {op.success === false && (
                    <Badge variant="destructive" className="text-xs">
                      Failed
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
