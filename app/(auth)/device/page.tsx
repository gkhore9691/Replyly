"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

function DeviceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const codeFromUrl = searchParams.get("code") ?? "";
  const [userCode, setUserCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const checkAuth = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) return true;
    return false;
  }, []);

  useEffect(() => {
    checkAuth().then((ok) => {
      if (!ok && codeFromUrl) {
        const callbackUrl = `/device?code=${encodeURIComponent(codeFromUrl)}`;
        router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }
    });
  }, [codeFromUrl, checkAuth, router]);

  useEffect(() => {
    if (codeFromUrl) setUserCode(codeFromUrl);
  }, [codeFromUrl]);

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    const code = userCode.trim();
    if (!code) {
      toast({
        title: "Code required",
        description: "Enter the code shown in your terminal.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/device/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Authorization failed",
          description: data.error ?? "Invalid or expired code",
          variant: "destructive",
        });
        return;
      }
      setAuthorized(true);
      toast({
        title: "CLI authorized",
        description: "You can close this page and return to your terminal.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const [hasChecked, setHasChecked] = useState(false);
  useEffect(() => {
    checkAuth().then((ok) => {
      if (!ok && codeFromUrl) {
        const callbackUrl = `/device?code=${encodeURIComponent(codeFromUrl)}`;
        router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }
      setHasChecked(true);
    });
  }, [codeFromUrl, checkAuth, router]);

  if (!hasChecked) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (authorized) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>CLI authorized</CardTitle>
          <CardDescription>
            Your terminal should complete sign-in shortly. You can close this
            tab.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Authorize Replayly CLI</CardTitle>
        <CardDescription>
          Enter the code displayed in your terminal to link this device.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleAuthorize}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="code"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Code
            </label>
            <input
              id="code"
              type="text"
              placeholder="XXXX-XXXX"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value.toUpperCase())}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              autoComplete="one-time-code"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Authorizing..." : "Authorize CLI"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Not signed in?{" "}
            <Link href="/login" className="underline hover:text-foreground">
              Sign in
            </Link>{" "}
            first, then return here with your code.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function DevicePage() {
  return (
    <Suspense fallback={<Card className="w-full max-w-md"><CardContent className="pt-6"><div className="h-20 w-full rounded-sm bg-white/5 animate-pulse" /></CardContent></Card>}>
      <DeviceContent />
    </Suspense>
  );
}
