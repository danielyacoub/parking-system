"use client";

import { useEffect, useState } from "react";
import {
  DoorOpenIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react";

import { GateActivityTable } from "@/components/gate-activity-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GateLogDTO } from "@/types/parking";

type GatesResponse = {
  logs: GateLogDTO[];
};

export default function AdminGatesPage() {
  const [logs, setLogs] = useState<GateLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/gates?limit=100", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("The gate logs could not be loaded.");
        }

        const payload = (await response.json()) as GatesResponse;

        if (!cancelled) {
          setLogs(payload.logs);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The gate logs could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const opened = logs.filter((log) => log.event === "OPENED").length;
  const unauthorized = logs.filter(
    (log) => log.event === "UNAUTHORIZED_ATTEMPT",
  ).length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
            Administration
          </p>
          <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
            Gate logs
          </h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Every gate opening, closure, and unauthorized attempt recorded by
            the controller.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">
            <DoorOpenIcon aria-hidden="true" />
            {opened} opened
          </Badge>
          {unauthorized > 0 ? (
            <Badge variant="destructive">
              <ShieldAlertIcon aria-hidden="true" />
              {unauthorized} unauthorized
            </Badge>
          ) : null}
          <Button
            aria-label="Refresh gate logs"
            disabled={loading}
            onClick={() => setReloadKey((key) => key + 1)}
            size="sm"
            variant="outline"
          >
            <RefreshCwIcon
              aria-hidden="true"
              className={loading ? "animate-spin" : undefined}
            />
            Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load gate logs</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && logs.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-xl border bg-card">
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            Loading gate activity…
          </span>
        </div>
      ) : (
        <GateActivityTable logs={logs} />
      )}
    </div>
  );
}
