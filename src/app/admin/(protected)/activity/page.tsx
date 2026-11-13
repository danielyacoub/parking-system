"use client";

import { useEffect, useState } from "react";
import { HistoryIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react";

import { SlotHistoryTable } from "@/components/slot-history-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SlotActivityDTO } from "@/types/parking";

type ActivityResponse = {
  logs: SlotActivityDTO[];
};

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<SlotActivityDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/activity?limit=100", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("The slot history could not be loaded.");
        }

        const payload = (await response.json()) as ActivityResponse;

        if (!cancelled) {
          setLogs(payload.logs);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The slot history could not be loaded.",
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

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
            Administration
          </p>
          <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
            Slot history
          </h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Occupancy cycles recorded from the bay sensors, including how long
            each stay lasted.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <HistoryIcon aria-hidden="true" />
            {logs.length} cycles
          </Badge>
          <Button
            aria-label="Refresh slot history"
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
          <AlertTitle>Unable to load slot history</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && logs.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-xl border bg-card">
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            Loading slot history…
          </span>
        </div>
      ) : (
        <SlotHistoryTable logs={logs} />
      )}
    </div>
  );
}
