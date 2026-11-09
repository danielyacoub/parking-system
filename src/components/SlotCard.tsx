import { Clock3Icon, MapPinIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatSlotNumber, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ParkingSlotDTO } from "@/types/parking";

export function SlotCard({ slot }: { slot: ParkingSlotDTO }) {
  return (
    <Card
      className={cn(
        "relative gap-3 overflow-hidden py-4 transition-shadow hover:shadow-sm",
        slot.isOccupied && "bg-muted/30",
      )}
      data-occupied={slot.isOccupied}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          slot.isOccupied ? "bg-destructive/60" : "bg-success/70",
        )}
      />

      <CardHeader className="gap-2 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums",
                slot.isOccupied
                  ? "bg-destructive/10 text-destructive"
                  : "bg-success/10 text-success",
              )}
            >
              {formatSlotNumber(slot.slotNumber)}
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-sm">{slot.slotId}</CardTitle>
              <p className="truncate text-xs text-muted-foreground">
                Bay {slot.slotNumber}
              </p>
            </div>
          </div>
          <Badge variant={slot.isOccupied ? "warning" : "success"}>
            {slot.isOccupied ? "Occupied" : "Available"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex items-end justify-between gap-3 px-4">
        <p className="font-semibold text-3xl tabular-nums tracking-tight">
          {formatSlotNumber(slot.slotNumber)}
        </p>

        <div className="flex flex-col items-end gap-1 text-right text-xs text-muted-foreground">
          {slot.zone ? (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon aria-hidden="true" className="size-3" />
              {slot.zone}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock3Icon aria-hidden="true" className="size-3" />
            {formatTime(slot.lastStateChangedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
