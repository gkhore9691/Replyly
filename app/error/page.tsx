import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      {message && (
        <p className="text-muted-foreground text-center max-w-md">
          {message}
        </p>
      )}
      <Button asChild>
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
