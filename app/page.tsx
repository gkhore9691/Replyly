import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Replayly</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Distributed backend debugging platform — capture production request
        lifecycles and replay them locally.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/signup">Create account</Link>
        </Button>
      </div>
    </div>
  );
}
