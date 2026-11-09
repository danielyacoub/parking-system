import type { LucideIcon } from "lucide-react";
import {
  CarFrontIcon,
  CircleCheckIcon,
  GaugeIcon,
  SquareParkingIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ParkingStats } from "@/types/parking";

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  progress?: {
    value: number;
    indicatorClassName: string;
  };
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  progress,
}: StatCardProps) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex items-start justify-between gap-3 px-4">
        <CardTitle className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </CardTitle>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            tone === "success" && "bg-success/10 text-success",
            tone === "warning" && "bg-warning/15 text-warning",
            tone === "destructive" && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4">
        <p className="font-semibold text-3xl tabular-nums tracking-tight">
          {value}
        </p>
        {progress ? (
          <Progress
            aria-label={`${label}: ${progress.value}%`}
            className="h-1.5"
            indicatorClassName={progress.indicatorClassName}
            value={progress.value}
          />
        ) : null}
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function StatsCards({ stats }: { stats: ParkingStats }) {
  const occupancyTone =
    stats.occupancyRate >= 80
      ? "destructive"
      : stats.occupancyRate >= 50
        ? "warning"
        : "success";

  const occupancyIndicator =
    stats.occupancyRate >= 80
      ? "bg-destructive"
      : stats.occupancyRate >= 50
        ? "bg-warning"
        : "bg-success";

  return (
    <section
      aria-label="Parking occupancy overview"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        hint="Provisioned in the lot"
        icon={SquareParkingIcon}
        label="Total spaces"
        value={String(stats.total)}
      />
      <StatCard
        hint="Ready for the next vehicle"
        icon={CircleCheckIcon}
        label="Available slots"
        tone="success"
        value={String(stats.available)}
      />
      <StatCard
        hint="Currently in use"
        icon={CarFrontIcon}
        label="Occupied slots"
        tone={stats.occupied > 0 ? "warning" : "default"}
        value={String(stats.occupied)}
      />
      <StatCard
        hint="Live lot utilisation"
        icon={GaugeIcon}
        label="Occupancy rate"
        progress={{
          value: stats.occupancyRate,
          indicatorClassName: occupancyIndicator,
        }}
        tone={occupancyTone}
        value={`${stats.occupancyRate.toFixed(1)}%`}
      />
    </section>
  );
}
