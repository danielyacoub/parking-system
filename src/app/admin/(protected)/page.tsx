"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CarFrontIcon,
  DoorOpenIcon,
  HistoryIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { GateActivityTable } from "@/components/gate-activity-table";
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
import type { GateLogDTO, ParkingStats, SlotsResponse } from "@/types/parking";

const quickLinks = [
  {
    href: "/admin/slots",
    title: "Parking slots",
    description: "Inspect every bay and the current occupancy across the lot.",
    icon: CarFrontIcon,
  },
  {
    href: "/admin/gates",
    title: "Gate logs",
    description: "Review gate openings, closures, and unauthorized attempts.",
    icon: DoorOpenIcon,
  },
  {
    href: "/admin/activity",
    title: "Slot history",
    description: "Follow occupancy cycles and how long each stay lasted.",
    icon: HistoryIcon,
  },
] as const;

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<ParkingStats | null>(null);
  const [gateLogs, setGateLogs] = useState<GateLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [slotsResponse, gatesResponse] = await Promise.all([
          fetch("/api/slots?page=1&limit=1", { cache: "no-store" }),
          fetch("/api/gates?limit=5", { cache: "no-store" }),
        ]);

        if (!slotsResponse.ok || !gatesResponse.ok) {
          throw new Error("The admin data could not be loaded.");
        }

        const slots = (await slotsResponse.json()) as SlotsResponse;
        const gates = (await gatesResponse.json()) as { logs: GateLogDTO[] };

        if (!cancelled) {
          setStats(slots.stats);
          setGateLogs(gates.logs);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The admin data could not be loaded.",
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
            Operations overview
          </h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Live occupancy, gate activity, and slot history for the HK Parking
            lot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <ShieldCheckIcon aria-hidden="true" />
            Signed in as admin
          </Badge>
          <Button
            aria-label="Refresh admin data"
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
          <AlertTitle>Unable to load the admin overview</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {stats ? (
        <StatsCards stats={stats} />
      ) : (
        <div className="grid min-h-32 place-items-center rounded-xl border bg-card">
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            Loading lot statistics…
          </span>
        </div>
      )}

      <section
        aria-label="Admin shortcuts"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {quickLinks.map((link) => {
          const Icon = link.icon;

          return (
            <Link className="group" href={link.href} key={link.href}>
              <Card className="h-full gap-3 py-4 transition-colors group-hover:bg-muted/40">
                <CardHeader className="px-4">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <CardTitle className="flex items-center justify-between gap-2 text-sm">
                    {link.title}
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <CardDescription>{link.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      {loading && !stats ? (
        <div className="grid min-h-48 place-items-center rounded-xl border bg-card">
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            Loading gate activity…
          </span>
        </div>
      ) : (
        <GateActivityTable logs={gateLogs} />
      )}
    </div>
  );
}
