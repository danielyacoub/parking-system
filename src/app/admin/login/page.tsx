"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  SquareParkingIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Invalid username or password.");
        return;
      }

      const redirectTo = new URLSearchParams(window.location.search).get(
        "redirect",
      );
      const destination =
        redirectTo?.startsWith("/admin") || redirectTo?.startsWith("/dashboard")
          ? redirectTo
          : "/admin";

      router.replace(destination);
      router.refresh();
    } catch {
      setError("The login request failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-muted/25 p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/5 to-transparent"
      />

      <div className="relative flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <SquareParkingIcon aria-hidden="true" className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-lg tracking-tight">HK Parking</p>
            <p className="text-muted-foreground text-sm">
              Sign in to the administration console
            </p>
          </div>
        </div>

        <Card className="gap-5 py-6">
          <CardHeader className="px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyholeIcon aria-hidden="true" className="size-4" />
              Admin login
            </CardTitle>
            <CardDescription>
              Access parking slots, gate logs, and slot history.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  autoComplete="username"
                  disabled={submitting}
                  id="username"
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  required
                  value={username}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  autoComplete="current-password"
                  disabled={submitting}
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Unable to sign in</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                aria-busy={submitting}
                className="w-full"
                disabled={submitting}
                type="submit"
              >
                {submitting ? (
                  <>
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="animate-spin"
                    />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <p className="mt-4 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-center text-muted-foreground text-xs">
              Demo credentials: <code>admin</code> / <code>admin123</code>
            </p>
          </CardContent>
        </Card>

        <Button asChild className="mx-auto" size="sm" variant="ghost">
          <Link href="/dashboard">
            <ArrowLeftIcon aria-hidden="true" />
            Back to live dashboard
          </Link>
        </Button>
      </div>
    </main>
  );
}
