"use client";

import { cn } from "@/lib/utils";

interface JsonViewProps {
  data: unknown;
  className?: string;
}

export function JsonView({ data, className }: JsonViewProps) {
  let text: string;
  try {
    text =
      data === undefined || data === null
        ? ""
        : typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2);
  } catch {
    text = String(data);
  }

  return (
    <pre
      className={cn(
        "overflow-auto rounded-md border bg-muted/50 p-4 text-sm font-mono",
        className
      )}
    >
      <code className="text-foreground">{text || "—"}</code>
    </pre>
  );
}
