import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DatabaseZapIcon, LoaderCircleIcon } from "lucide-react";

import { ParkingDashboard } from "@/components/parking-dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardSnapshot } from "@/lib/parking";

export const metadata: Metadata = {
  title: "Live dashboard · HK Parking",
  description:
    "Real-time smart parking occupancy, gate activity, and slot history.",
};

function DatabaseUnavailable({ detail }: { detail?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZapIcon aria-hidden="true" />
            MongoDB is not reachable
          </CardTitle>
          <CardDescription>
            HK Parking needs a MongoDB connection before it can show live lot
            data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>Connection failed</AlertTitle>
            <AlertDescription>
              Check that MongoDB is running and that{" "}
              <code className="text-xs">MONGODB_URI</code> in{" "}
              <code className="text-xs">.env.local</code> points to it.
            </AlertDescription>
          </Alert>

          {detail ? (
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-muted-foreground text-xs">
              {detail}
            </pre>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/dashboard">Retry</a>
            </Button>
            <Button asChild variant="ghost">
              <a href="https://www.mongodb.com/docs/manual/administration/install-community/">
                MongoDB setup guide
              </a>
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Then run <code>pnpm seed</code> once to provision the demo lot.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
          <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-muted-foreground text-sm shadow-sm">
            <LoaderCircleIcon
              aria-hidden="true"
              className="size-4 animate-spin"
            />
            Loading live parking data…
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  // The dashboard reads live MongoDB state, so it must render per request.
  await connection();

  let snapshot: Awaited<ReturnType<typeof getDashboardSnapshot>> | null = null;
  let failure: unknown = null;

  try {
    snapshot = await getDashboardSnapshot();
  } catch (error) {
    failure = error;
    console.error("[dashboard] Unable to load snapshot:", error);
  }

  if (!snapshot) {
    return (
      <DatabaseUnavailable
        detail={failure instanceof Error ? failure.message : undefined}
      />
    );
  }

  return <ParkingDashboard snapshot={snapshot} />;
}
