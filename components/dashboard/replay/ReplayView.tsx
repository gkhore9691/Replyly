"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Play, Database, Globe, Copy, Zap } from "lucide-react";

type ReplayMode = "dry" | "mock" | "hybrid";

const MODES: { id: ReplayMode; label: string; desc: string; icon: React.ElementType }[] = [
  { id: "dry", label: "DRY MODE", desc: "Replay against real DB and services", icon: Zap },
  { id: "mock", label: "MOCK MODE", desc: "All DB and external calls mocked", icon: Copy },
  { id: "hybrid", label: "HYBRID MODE", desc: "Mix of real and mocked operations", icon: Database },
];

interface ReplayViewProps {
  projectId: string;
  eventId: string;
  event: { method?: string; route?: string };
}

export function ReplayView({ projectId, eventId, event }: ReplayViewProps) {
  const [mode, setMode] = useState<ReplayMode>("dry");
  const [targetUrl, setTargetUrl] = useState("http://localhost:3000");
  const [portMapping, setPortMapping] = useState("");
  const [skipDbMutations, setSkipDbMutations] = useState(true);
  const [skipExternalCalls, setSkipExternalCalls] = useState(false);
  const [verboseLogging, setVerboseLogging] = useState(false);
  const [lines, setLines] = useState<{ type: "prompt" | "success" | "error" | "info"; text: string }[]>([]);
  const [executing, setExecuting] = useState(false);

  const executeReplay = () => {
    setExecuting(true);
    setLines([
      { type: "info", text: "Reconstructing request..." },
      { type: "prompt", text: "> POST " + (event.route ?? "") + " → " + targetUrl },
      { type: "info", text: "Skip DB mutations: " + (skipDbMutations ? "yes" : "no") },
      { type: "info", text: "Skip external calls: " + (skipExternalCalls ? "yes" : "no") },
      { type: "success", text: "Request sent." },
      { type: "info", text: "Waiting for response..." },
      { type: "success", text: "200 OK (replay)" },
    ]);
    setExecuting(false);
  };

  const clearOutput = () => setLines([]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <nav className="flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
        <Link href={`/dashboard/${projectId}/events`} className="hover:text-[var(--accent)]">
          Events
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/dashboard/${projectId}/events/${eventId}`}
          className="hover:text-[var(--accent)]"
        >
          {event.method} {event.route}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--fg)]">Replay</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left: Config */}
        <Card>
          <CardHeader>
            <p className="font-mono text-xs text-[var(--muted)]">
              ( REPLAY CONFIG )
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium text-[var(--muted)]">Mode</p>
              <div className="space-y-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex w-full items-start gap-3 rounded-sm border p-3 text-left transition-colors ${
                      mode === m.id
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-[var(--border)] bg-transparent hover:bg-white/[0.04]"
                    }`}
                  >
                    <m.icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        mode === m.id ? "text-[var(--accent)]" : "text-[var(--muted)]"
                      }`}
                    />
                    <div>
                      <p
                        className={`font-mono text-xs font-medium ${
                          mode === m.id ? "text-[var(--accent)]" : "text-[var(--fg)]"
                        }`}
                      >
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {m.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[var(--muted)]">Target URL</Label>
              <Input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="http://localhost:3000"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[var(--muted)]">Port mapping</Label>
              <Input
                value={portMapping}
                onChange={(e) => setPortMapping(e.target.value)}
                placeholder="e.g. 5432:5432"
                className="font-mono"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[var(--muted)]">
                  Skip DB mutations
                </Label>
                <Switch
                  checked={skipDbMutations}
                  onCheckedChange={setSkipDbMutations}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[var(--muted)]">
                  Skip external calls
                </Label>
                <Switch
                  checked={skipExternalCalls}
                  onCheckedChange={setSkipExternalCalls}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[var(--muted)]">
                  Verbose logging
                </Label>
                <Switch
                  checked={verboseLogging}
                  onCheckedChange={setVerboseLogging}
                />
              </div>
            </div>

            <Button
              className="w-full bg-[var(--accent)] font-heading text-[var(--bg)] hover:opacity-90 uppercase"
              size="lg"
              onClick={executeReplay}
              disabled={executing}
            >
              <Play className="mr-2 h-4 w-4" />
              Execute Replay
            </Button>

            <Button
              className="w-full font-mono text-xs"
              variant="outline"
              asChild
            >
              <Link href={`/dashboard/${projectId}/events/${eventId}/mocks`}>
                Open mock editor
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Right: Terminal */}
        <Card className="flex flex-col bg-[#050505] border-[var(--border)]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)] py-3">
            <p className="font-mono text-xs text-[var(--muted)]">
              ( OUTPUT )
            </p>
            <Button variant="ghost" size="sm" onClick={clearOutput}>
              Clear
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-4 font-mono text-sm min-h-[320px]">
            {lines.length === 0 ? (
              <p className="text-[var(--muted)]">
                Ready. Configure replay and click EXECUTE.
              </p>
            ) : (
              <div className="space-y-1">
                <AnimatePresence>
                  {lines.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={
                        line.type === "prompt"
                          ? "text-[var(--accent)]"
                          : line.type === "success"
                            ? "text-[var(--green)]"
                            : line.type === "error"
                              ? "text-[var(--red)]"
                              : "text-[var(--muted)]"
                      }
                    >
                      {line.text}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
