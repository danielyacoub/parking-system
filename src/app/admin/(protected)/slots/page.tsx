"use client";

import { useEffect, useState } from "react";
import {
  CarFrontIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from "lucide-react";

import { StatsCards } from "@/components/stats-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatDateTime, formatSlotNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SlotsResponse } from "@/types/parking";

export default function AdminSlotsPage() {
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/slots?page=1&limit=48", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("The parking slots could not be loaded.");
        }

        const payload = (await response.json()) as SlotsResponse;

        if (!cancelled) {
          setData(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The parking slots could not be loaded.",
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
            Parking slots
          </h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Live occupancy reported by the ESP8266 bay sensors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {data?.pagination.total ?? 0} bays
          </Badge>
          <Button
            aria-label="Refresh parking slots"
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
          <AlertTitle>Unable to load parking slots</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {data ? <StatsCards stats={data.stats} /> : null}

      {loading && !data ? (
        <div className="grid min-h-64 place-items-center rounded-xl border bg-card">
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            Loading parking bays…
          </span>
        </div>
      ) : !data || data.slots.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CarFrontIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No parking slots provisioned</EmptyTitle>
            <EmptyDescription>
              Add slots to MongoDB or run <code className="text-xs">pnpm seed</code>{" "}
              to create the demo lot.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section
          aria-label="Parking slot list"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {data.slots.map((slot) => (
            <Card
              className={cn(
                "gap-3 py-4 transition-colors",
                slot.isOccupied
                  ? "border-warning/35 bg-warning/5"
                  : "border-success/30 bg-success/5",
              )}
              key={slot.slotId}
            >
              <CardHeader className="flex items-start justify-between gap-3 px-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        slot.isOccupied ? "bg-warning" : "bg-success",
                      )}
                    />
                    {slot.slotId}
                  </CardTitle>
                  <CardDescription>
                    Bay {formatSlotNumber(slot.slotNumber)}
                    {slot.zone ? ` · ${slot.zone}` : ""}
                  </CardDescription>
                </div>
                <Badge
                  variant={slot.isOccupied ? "warning" : "success"}
                >
                  {slot.isOccupied ? (
                    <CarFrontIcon aria-hidden="true" />
                  ) : (
                    <CircleCheckIcon aria-hidden="true" />
                  )}
                  {slot.isOccupied ? "Occupied" : "Available"}
                </Badge>
              </CardHeader>
              <CardContent className="px-4 pt-0">
                <p className="text-muted-foreground text-xs">
                  Last change {formatDateTime(slot.lastStateChangedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
