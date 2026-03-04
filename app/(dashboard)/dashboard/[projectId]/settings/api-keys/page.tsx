import Link from "next/link";
import { ApiKeyList } from "@/components/dashboard/api-key-list";
import { CreateApiKeyDialog } from "@/components/dashboard/create-api-key-dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-[var(--muted)] tracking-wider">
            ( API KEYS )
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">
            API Keys
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create and manage API keys for SDK authentication
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/${projectId}/settings`}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <CreateApiKeyDialog projectId={projectId} />
        </div>
      </div>
      <ApiKeyList projectId={projectId} />
    </div>
  );
}
