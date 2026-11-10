import { DoorOpenIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { GateEvent, GateLogDTO, GateTrigger } from "@/types/parking";

const eventVariants: Record<
  GateEvent,
  "success" | "secondary" | "destructive"
> = {
  OPENED: "success",
  CLOSED: "secondary",
  UNAUTHORIZED_ATTEMPT: "destructive",
};

const eventLabels: Record<GateEvent, string> = {
  OPENED: "Opened",
  CLOSED: "Closed",
  UNAUTHORIZED_ATTEMPT: "Unauthorized",
};

const triggerLabels: Record<GateTrigger, string> = {
  MQTT_SENSOR: "MQTT sensor",
  ADMIN_OVERRIDE: "Admin override",
  RFID: "RFID",
};

export function GateActivityTable({ logs }: { logs: GateLogDTO[] }) {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Gate activity</CardTitle>
            <CardDescription>
              Inbound, outbound, and unauthorized gate events.
            </CardDescription>
          </div>
          <Badge variant="secondary">{logs.length} events</Badge>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {logs.length === 0 ? (
          <Empty className="mx-4 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <DoorOpenIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No gate activity yet</EmptyTitle>
              <EmptyDescription>
                Events published to{" "}
                <code className="text-xs">parking/gates/#</code> will appear
                here instantly.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableCaption className="sr-only">
              Recent gate activity
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Gate</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead className="pr-4 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="pl-4 font-medium">
                    {log.gateId}
                  </TableCell>
                  <TableCell>
                    <Badge variant={eventVariants[log.event]}>
                      {eventLabels[log.event]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {triggerLabels[log.triggeredBy]}
                  </TableCell>
                  <TableCell className="whitespace-nowrap pr-4 text-right text-muted-foreground tabular-nums">
                    {formatDateTime(log.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
