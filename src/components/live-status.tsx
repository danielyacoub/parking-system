import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LiveConnectionStatus } from "@/types/parking";

const statuses: Record<
  LiveConnectionStatus,
  { label: string; dot: string; description: string }
> = {
  connected: {
    label: "Live",
    dot: "bg-success",
    description: "Connected to the realtime event stream.",
  },
  connecting: {
    label: "Connecting",
    dot: "bg-warning",
    description: "Connecting to the realtime event stream.",
  },
  disconnected: {
    label: "Offline",
    dot: "bg-destructive",
    description:
      "Realtime stream unavailable. Reconnecting automatically.",
  },
};

export function LiveStatus({ status }: { status: LiveConnectionStatus }) {
  const config = statuses[status];

  return (
    <Badge
      aria-live="polite"
      className="gap-2"
      title={config.description}
      variant="outline"
    >
      <span className="relative flex size-2">
        {status === "connected" ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            config.dot,
            status === "connecting" && "animate-pulse",
          )}
        />
      </span>
      {config.label}
    </Badge>
  );
}
