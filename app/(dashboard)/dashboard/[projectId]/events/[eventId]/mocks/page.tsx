'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ChevronRight, Save, X } from "lucide-react";

interface EventMocksPageProps {
  params: { projectId: string; eventId: string };
}

interface EventMockRecord {
  id: string;
  eventId: string;
  projectId: string;
  mockType: string;
  identifier: string;
  request?: Record<string, unknown> | null;
  response: Record<string, unknown>;
}

export default function EventMocksPage({ params }: EventMocksPageProps) {
  const { projectId, eventId } = params;
  const [mocks, setMocks] = useState<EventMockRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedResponse, setEditedResponse] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchMocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function fetchMocks() {
    const res = await fetch(`/api/events/${eventId}/mocks`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { mocks?: EventMockRecord[] };
    setMocks(data.mocks ?? []);
  }

  const externalApiMocks = mocks.filter((m) => m.mockType === "external_api");
  const databaseMocks = mocks.filter((m) => m.mockType === "database");

  function startEditing(mock: EventMockRecord) {
    setEditingId(mock.id);
    setEditedResponse(JSON.stringify(mock.response, null, 2));
  }

  async function saveCurrentMock() {
    if (!editingId) return;
    setSaving(true);
    try {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(editedResponse || "{}");
      } catch {
        // keep as empty object if invalid JSON
      }
      const res = await fetch(
        `/api/events/${eventId}/mocks/${encodeURIComponent(editingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: parsed }),
        }
      );
      if (res.ok) {
        await fetchMocks();
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
        <Link
          href={`/dashboard/${projectId}/events`}
          className="hover:text-[var(--accent)]"
        >
          Events
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/dashboard/${projectId}/events/${eventId}`}
          className="hover:text-[var(--accent)]"
        >
          Event
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--fg)]">Mocks</span>
      </nav>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Mock Data Editor</h1>
        <p className="text-sm text-[var(--muted)]">
          View and edit mocked responses used during local replays.
        </p>
      </div>

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList>
          <TabsTrigger value="api">
            External APIs ({externalApiMocks.length})
          </TabsTrigger>
          <TabsTrigger value="database">
            Database ({databaseMocks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          {externalApiMocks.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No external API calls were captured for this event.
            </p>
          ) : (
            externalApiMocks.map((mock) => (
              <Card key={mock.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {mock.request && "method" in mock.request && (
                        <Badge variant="outline">
                          {String(mock.request.method)}
                        </Badge>
                      )}
                      <code className="text-xs break-all">
                        {String(mock.identifier)}
                      </code>
                    </div>
                    {mock.response?.statusCode !== undefined && (
                      <p className="text-xs text-[var(--muted)]">
                        Status: {String(mock.response.statusCode)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {editingId === mock.id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(mock)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editingId === mock.id ? (
                    <>
                      <textarea
                        className="h-64 w-full rounded border border-[var(--border)] bg-black/20 p-2 font-mono text-xs"
                        value={editedResponse}
                        onChange={(e) => setEditedResponse(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={saveCurrentMock}
                        disabled={saving}
                      >
                        <Save className="mr-1 h-4 w-4" />
                        {saving ? "Saving..." : "Save mock"}
                      </Button>
                    </>
                  ) : (
                    <pre className="max-h-64 overflow-auto rounded bg-black/30 p-3 text-xs">
                      {JSON.stringify(mock.response, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          {databaseMocks.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No database operations were captured for this event.
            </p>
          ) : (
            databaseMocks.map((mock) => (
              <Card key={mock.id}>
                <CardHeader>
                  <Badge variant="outline">{mock.mockType}</Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {mock.request && "query" in mock.request && (
                    <div>
                      <p className="mb-1 font-semibold text-[var(--muted)]">
                        Query
                      </p>
                      <pre className="max-h-40 overflow-auto rounded bg-black/30 p-2">
                        {String((mock.request as { query?: unknown }).query)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 font-semibold text-[var(--muted)]">
                      Result
                    </p>
                    <pre className="max-h-40 overflow-auto rounded bg-black/30 p-2">
                      {JSON.stringify(mock.response, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

