"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeyList({ projectId }: { projectId: string }) {
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/api-keys/list`)
      .then((res) => res.json())
      .then((data) => {
        if (data.apiKeys) setApiKeys(data.apiKeys);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-sm bg-white/5 animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            No API keys yet. Create an API key to connect the Replayly SDK to this project.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-white/5">
          {apiKeys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-white/[0.02]"
            >
              <div>
                <p className="font-medium text-[var(--fg)]">{key.name}</p>
                <p className="text-sm font-mono text-[var(--muted)]">
                  {key.keyPrefix}...
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt &&
                    ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">Active</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
