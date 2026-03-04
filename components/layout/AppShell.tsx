"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Activity,
  RefreshCw,
  FolderDot,
  GitBranch,
  Settings2,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";

const RESERVED_SEGMENTS = ["projects", "new-project", "new-organization"] as const;

const navConfig = [
  { segment: "", label: "Dashboard", icon: LayoutDashboard },
  { segment: "events", label: "Events", icon: Activity },
  { segment: "replay", label: "Replay", icon: RefreshCw },
  { segment: "projects", label: "Projects", icon: FolderDot },
  { segment: "releases", label: "Releases", icon: GitBranch },
  { segment: "settings", label: "Settings", icon: Settings2 },
] as const;

type Env = "PRODUCTION" | "STAGING" | "DEVELOPMENT";

const envColors: Record<Env, string> = {
  PRODUCTION: "bg-[var(--green)]/10 text-[var(--green)] border-[var(--green)]/50",
  STAGING: "bg-[var(--yellow)]/10 text-[var(--yellow)] border-[var(--yellow)]/50",
  DEVELOPMENT: "bg-[var(--muted)]/20 text-[var(--muted)] border-[var(--border)]",
};

interface AppShellProps {
  user?: { email: string; name: string | null } | null;
  projects?: { id: string; name: string }[];
  currentProjectId?: string | null;
  environment?: Env;
  children: React.ReactNode;
}

export function AppShell({
  user,
  projects = [],
  currentProjectId,
  environment = "PRODUCTION",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const firstSegment = pathname.match(/^\/dashboard\/([^/]+)/)?.[1] ?? null;
  const projectIdFromPath =
    firstSegment && !(RESERVED_SEGMENTS as readonly string[]).includes(firstSegment)
      ? firstSegment
      : null;
  const activeProjectId = currentProjectId ?? projectIdFromPath;

  const navItems = navConfig.map(({ segment, label, icon }) => {
    const href =
      segment === ""
        ? activeProjectId
          ? `/dashboard/${activeProjectId}`
          : "/dashboard"
        : segment === "projects"
          ? "/dashboard/projects"
          : activeProjectId
            ? `/dashboard/${activeProjectId}/${segment}`
            : "/dashboard";
    return { href, label, icon, segment };
  });

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="flex h-screen bg-[var(--bg)]">
      {/* Sidebar */}
      <aside
        className="flex w-56 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)]"
        style={{ width: "14rem" }}
      >
        <div className="flex h-14 items-center border-b border-[var(--border)] px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-heading font-bold text-[var(--fg)]"
          >
            Replayly
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {navItems.map(({ href, label, icon: Icon, segment }) => {
            const isActive =
              segment === ""
                ? pathname === href
                : segment === "projects"
                  ? pathname === "/dashboard/projects"
                  : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={`${segment}-${href}`}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                  "border-l-2",
                  isActive
                    ? "border-[var(--accent)] bg-white/[0.04] text-[var(--accent)]"
                    : "border-transparent text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--fg)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <div className="mb-2 text-xs font-mono text-[var(--muted)]">
            SDK v1.x
          </div>
          <a
            href="#"
            className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
          >
            <FileText className="h-3.5 w-3.5" />
            Docs
          </a>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)] px-6">
          <div className="flex items-center gap-4">
            <Select
              value={
                activeProjectId && projects.some((p) => p.id === activeProjectId)
                  ? activeProjectId
                  : projects[0]?.id ?? "none"
              }
              onValueChange={(v) => {
                if (v !== "none") {
                  window.location.href = `/dashboard/${v}`;
                }
              }}
            >
              <SelectTrigger className="w-[220px] border-[var(--border)] bg-[#111]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 ? (
                  <SelectItem value="none">No projects</SelectItem>
                ) : (
                  projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Badge
              variant="outline"
              className={cn("font-mono text-xs", envColors[environment])}
            >
              {environment}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full"
              >
                <Avatar className="h-9 w-9 border border-[var(--border)]">
                  <AvatarFallback className="bg-[#111] text-[var(--fg)] text-xs font-mono">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 border-[var(--border)] bg-[var(--bg-card)]"
            >
              <div className="flex flex-col gap-1 p-2">
                {user?.name && (
                  <p className="text-sm font-medium text-[var(--fg)]">
                    {user.name}
                  </p>
                )}
                <p className="text-xs text-[var(--muted)]">{user?.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-[var(--border)]" />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--border)]" />
              <DropdownMenuItem
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="text-[var(--red)] focus:text-[var(--red)]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
