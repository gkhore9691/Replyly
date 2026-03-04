import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StackTraceProps {
  error?: {
    message?: string;
    name?: string;
    stack?: string;
  };
}

export function StackTrace({ error }: StackTraceProps) {
  if (!error) return null;

  const message = error.message ?? "Unknown error";
  const name = error.name ?? "Error";
  const stack = error.stack ?? "";

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm font-medium">{message}</p>
        {stack && (
          <pre className="overflow-auto rounded-md border bg-muted/50 p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
            {stack}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
