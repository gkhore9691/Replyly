"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Settings, Key, List, AlertCircle, BarChart3, GitBranch, Activity } from "lucide-react";

interface SidebarProps {
  projectId?: string;
  projectName?: string;
  organizationName?: string;
}

export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const segmentMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const projectId = props.projectId ?? segmentMatch?.[1];
  const projectName = props.projectName;
  const organizationName = props.organizationName;

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/40">
      <div className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <LayoutDashboard className="h-6 w-6" />
          Replayly
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {projectId && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {organizationName ?? "Organization"}
            </div>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {projectName ?? "Project"}
            </div>
            <Link
              href={`/dashboard/${projectId}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === `/dashboard/${projectId}` || pathname?.startsWith(`/dashboard/${projectId}/events`)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
              Events
            </Link>
            <Link
              href={`/dashboard/${projectId}/errors`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname?.startsWith(`/dashboard/${projectId}/errors`)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <AlertCircle className="h-4 w-4" />
              Errors
            </Link>
            <Link
              href={`/dashboard/${projectId}/analytics`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname?.startsWith(`/dashboard/${projectId}/analytics`)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Link>
            <Link
              href={`/dashboard/${projectId}/releases`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname?.startsWith(`/dashboard/${projectId}/releases`)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <GitBranch className="h-4 w-4" />
              Releases
            </Link>
            <Link
              href={`/dashboard/${projectId}/activity`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname?.startsWith(`/dashboard/${projectId}/activity`)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Activity className="h-4 w-4" />
              Activity
            </Link>
            <Link
              href={`/dashboard/${projectId}/settings`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname?.startsWith(`/dashboard/${projectId}/settings`)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <Link
              href={`/dashboard/${projectId}/settings/api-keys`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname?.includes("api-keys")
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Key className="h-4 w-4" />
              API Keys
            </Link>
          </>
        )}
        {!projectId && (
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/dashboard"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        )}
      </nav>
    </aside>
  );
}
