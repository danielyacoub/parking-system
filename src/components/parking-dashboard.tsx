"use client";

import { useEffect, useState } from "react";
import {
  ChevronDownIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  SquareParkingIcon,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";

import { LiveStatus } from "@/components/live-status";
import { SlotCard } from "@/components/SlotCard";
import { StatsCards } from "@/components/stats-cards";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type {
  ClientToServerEvents,
  DashboardSnapshot,
  LiveConnectionStatus,
  ServerToClientEvents,
  SlotUpdatePayload,
  SlotsResponse,
} from "@/types/parking";

export function ParkingDashboard({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const [slots, setSlots] = useState(snapshot.slots);
  const [stats, setStats] = useState(snapshot.stats);
  const [pagination, setPagination] = useState(snapshot.pagination);
  const [liveStatus, setLiveStatus] =
    useState<LiveConnectionStatus>("connecting");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      path: "/api/socket_io",
    });

    socket.on("connect", () => {
      setLiveStatus("connected");
    });

    socket.on("disconnect", () => {
      setLiveStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setLiveStatus("disconnected");
    });

    socket.io.on("reconnect_attempt", () => {
      setLiveStatus("connecting");
    });

    const handleSlotUpdate = (payload: SlotUpdatePayload) => {
      setStats(payload.stats);
      setPagination((current) => ({
        ...current,
        total: payload.stats.total,
        hasMore: current.page * current.limit < payload.stats.total,
      }));

      setSlots((current) => {
        const index = current.findIndex(
          (slot) => slot.slotId === payload.slot.slotId,
        );

        if (index >= 0) {
          const next = current.slice();
          next[index] = payload.slot;
          return next;
        }

        const highestLoadedSlotNumber = current.reduce(
          (highest, slot) => Math.max(highest, slot.slotNumber),
          0,
        );

        if (payload.slot.slotNumber <= highestLoadedSlotNumber) {
          return [...current, payload.slot].sort(
            (a, b) => a.slotNumber - b.slotNumber,
          );
        }

        return current;
      });
    };

    socket.on("slotUpdate", handleSlotUpdate);

    return () => {
      socket.disconnect();
    };
  }, []);

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const nextPage = pagination.page + 1;
      const response = await fetch(
        `/api/slots?page=${nextPage}&limit=${pagination.limit}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Unable to load more slots.");
      }

      const data = (await response.json()) as SlotsResponse;
      setSlots((current) => {
        const existing = new Set(current.map((slot) => slot.slotId));
        return [...current, ...data.slots.filter((slot) => !existing.has(slot.slotId))];
      });
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (error) {
      setLoadMoreError(
        error instanceof Error ? error.message : "Unable to load more slots.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-2">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
            Live operations
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-semibold text-3xl tracking-tight">
                Parking overview
              </h1>
              <p className="max-w-2xl text-muted-foreground text-sm">
                Live bay occupancy reported by ESP8266 sensors over MQTT and
                streamed to this dashboard with Socket.io.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LiveStatus status={liveStatus} />
              <Button asChild size="sm" variant="outline">
                <a href="/admin">
                  <ShieldCheckIcon aria-hidden="true" />
                  Admin console
                </a>
              </Button>
            </div>
          </div>
        </section>

        <StatsCards stats={stats} />

        <section aria-labelledby="bays-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="font-semibold text-lg tracking-tight"
                id="bays-heading"
              >
                Live parking bays
              </h2>
              <p className="text-muted-foreground text-sm">
                Occupancy changes appear here without a refresh.
              </p>
            </div>
            <p className="text-muted-foreground text-sm tabular-nums">
              Showing {slots.length} of {stats.total}
            </p>
          </div>

          {slots.length === 0 ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SquareParkingIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No parking slots provisioned</EmptyTitle>
                <EmptyDescription>
                  Add slots to MongoDB or run{" "}
                  <code className="text-xs">pnpm seed</code> to create a demo
                  lot.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <p className="text-muted-foreground text-xs">
                  MQTT messages on <code>parking/slots/#</code> can also
                  auto-provision slots.
                </p>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {slots.map((slot) => (
                <SlotCard key={slot.slotId} slot={slot} />
              ))}
            </div>
          )}

          <div className="flex flex-col items-center gap-2 pt-2">
            {pagination.hasMore ? (
              <Button
                aria-busy={loadingMore}
                disabled={loadingMore}
                onClick={handleLoadMore}
                variant="outline"
              >
                {loadingMore ? (
                  <LoaderCircleIcon
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <ChevronDownIcon data-icon="inline-start" />
                )}
                {loadingMore ? "Loading slots…" : "Load more slots"}
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">
                All {stats.total} slots are shown.
              </p>
            )}

            {loadMoreError ? (
              <p className="text-destructive text-xs" role="alert">
                {loadMoreError}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-muted-foreground text-xs sm:px-6 lg:px-8">
          <p>HK Parking · IoT occupancy monitor</p>
          <p>MQTT → MongoDB → Socket.io</p>
        </div>
      </footer>
    </div>
  );
}
