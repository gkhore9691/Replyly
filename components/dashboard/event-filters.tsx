"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EventFiltersProps {
  projectId?: string;
}

export function EventFilters({ projectId }: EventFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      });
      next.set("page", "1");
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const route = searchParams.get("route") ?? "";
  const statusCode = searchParams.get("statusCode") ?? "";
  const isError = searchParams.get("isError") ?? "";
  const environment = searchParams.get("environment") ?? "";
  const search = searchParams.get("search") ?? "";
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  const clearFilters = useCallback(() => {
    router.push(pathname ?? "");
  }, [pathname, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Full-text search..."
              value={search}
              onChange={(e) => updateParams({ search: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="route">Route</Label>
            <Input
              id="route"
              placeholder="e.g. /api/users"
              value={route}
              onChange={(e) => updateParams({ route: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="statusCode">Status</Label>
            <select
              id="statusCode"
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              value={statusCode || "all"}
              onChange={(e) =>
                updateParams({
                  statusCode: e.target.value === "all" ? undefined : e.target.value,
                })
              }
            >
              <option value="all">Any</option>
              <option value="200">200</option>
              <option value="201">201</option>
              <option value="400">400</option>
              <option value="401">401</option>
              <option value="403">403</option>
              <option value="404">404</option>
              <option value="500">500</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="isError">Type</Label>
            <select
              id="isError"
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              value={isError || "all"}
              onChange={(e) =>
                updateParams({
                  isError: e.target.value === "all" ? undefined : e.target.value,
                })
              }
            >
              <option value="all">All</option>
              <option value="false">Success</option>
              <option value="true">Errors only</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="environment">Environment</Label>
            <Input
              id="environment"
              placeholder="e.g. production"
              value={environment}
              onChange={(e) =>
                updateParams({ environment: e.target.value || undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">From date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) =>
                updateParams({ startDate: e.target.value || undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">To date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) =>
                updateParams({ endDate: e.target.value || undefined })
              }
            />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      </CardContent>
    </Card>
  );
}
