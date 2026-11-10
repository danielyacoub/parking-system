import { HistoryIcon } from "lucide-react";

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
import { formatDateTime, formatDuration } from "@/lib/format";
import type { SlotActivityDTO } from "@/types/parking";

export function SlotHistoryTable({ logs }: { logs: SlotActivityDTO[] }) {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Slot usage history</CardTitle>
            <CardDescription>
              Occupancy cycles with the duration of the previous stay.
            </CardDescription>
          </div>
          <Badge variant="secondary">{logs.length} cycles</Badge>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {logs.length === 0 ? (
          <Empty className="mx-4 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HistoryIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No slot activity yet</EmptyTitle>
              <EmptyDescription>
                Occupancy changes will be recorded here as sensors report
                them.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableCaption className="sr-only">
              Recent slot usage history
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Slot</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="pr-4 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="pl-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{log.slotId}</span>
                      <span className="text-muted-foreground text-xs">
                        Bay {log.slotNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.action === "OCCUPIED" ? "warning" : "success"
                      }
                    >
                      {log.action === "OCCUPIED" ? "Occupied" : "Vacated"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDuration(log.durationMinutes)}
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
