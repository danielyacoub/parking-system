import type { Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { GateLogModel, type GateLog } from "@/models/GateLog";
import { ParkingSlotModel, type ParkingSlot } from "@/models/ParkingSlot";
import {
  SlotActivityLogModel,
  type SlotActivityLog,
} from "@/models/SlotActivityLog";
import type {
  GateEvent,
  GateLogDTO,
  GateTrigger,
  Pagination,
  ParkingSlotDTO,
  ParkingStats,
  SlotActivityDTO,
  SlotsResponse,
  SlotAction,
  SlotUpdatePayload,
} from "@/types/parking";

export const DEFAULT_PAGE_SIZE = 6;
export const MAX_PAGE_SIZE = 48;
export const DEFAULT_LOG_LIMIT = 20;

type LeanDocument<T> = T & { _id: Types.ObjectId };

export class SlotNotFoundError extends Error {
  constructor(slotId: string) {
    super(`Parking slot ${slotId} does not exist.`);
    this.name = "SlotNotFoundError";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function toSlotDTO(slot: LeanDocument<ParkingSlot>): ParkingSlotDTO {
  return {
    id: slot._id.toString(),
    slotId: slot.slotId,
    slotNumber: slot.slotNumber,
    isOccupied: slot.isOccupied,
    lastStateChangedAt: slot.lastStateChangedAt.toISOString(),
    ...(slot.zone ? { zone: slot.zone } : {}),
  };
}

function toActivityDTO(
  log: LeanDocument<SlotActivityLog>,
): SlotActivityDTO {
  return {
    id: log._id.toString(),
    slotId: log.slotId,
    slotNumber: log.slotNumber,
    action: log.action,
    timestamp: log.timestamp.toISOString(),
    ...(typeof log.durationMinutes === "number"
      ? { durationMinutes: log.durationMinutes }
      : {}),
  };
}

function toGateLogDTO(log: LeanDocument<GateLog>): GateLogDTO {
  return {
    id: log._id.toString(),
    gateId: log.gateId,
    event: log.event,
    triggeredBy: log.triggeredBy,
    timestamp: log.timestamp.toISOString(),
  };
}

export async function getParkingStats(totalOverride?: number): Promise<ParkingStats> {
  await connectDB();

  const [total, occupied] = await Promise.all([
    totalOverride ?? ParkingSlotModel.countDocuments(),
    ParkingSlotModel.countDocuments({ isOccupied: true }),
  ]);

  return {
    total,
    occupied,
    available: total - occupied,
    occupancyRate:
      total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0,
  };
}

export async function listSlots({
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
}: {
  page?: number;
  limit?: number;
} = {}): Promise<SlotsResponse> {
  await connectDB();

  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safeLimit = clamp(limit || DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const total = await ParkingSlotModel.countDocuments();

  const [documents, stats] = await Promise.all([
    ParkingSlotModel.find()
      .sort({ slotNumber: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    getParkingStats(total),
  ]);

  const slots = (documents as unknown as LeanDocument<ParkingSlot>[]).map(
    toSlotDTO,
  );

  const pagination: Pagination = {
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: safePage * safeLimit < total,
  };

  return { slots, stats, pagination };
}

export async function getRecentGateLogs(
  limit = DEFAULT_LOG_LIMIT,
): Promise<GateLogDTO[]> {
  await connectDB();

  const logs = await GateLogModel.find()
    .sort({ timestamp: -1 })
    .limit(clamp(limit, 1, 100))
    .lean();

  return (logs as unknown as LeanDocument<GateLog>[]).map(toGateLogDTO);
}

export async function getRecentActivityLogs(
  limit = DEFAULT_LOG_LIMIT,
  slotId?: string,
): Promise<SlotActivityDTO[]> {
  await connectDB();

  const filter = slotId ? { slotId: slotId.trim().toUpperCase() } : {};
  const logs = await SlotActivityLogModel.find(filter)
    .sort({ timestamp: -1 })
    .limit(clamp(limit, 1, 100))
    .lean();

  return (logs as unknown as LeanDocument<SlotActivityLog>[]).map(
    toActivityDTO,
  );
}

export type ApplySlotStateResult = {
  slot: ParkingSlotDTO;
  stats: ParkingStats;
  activity?: SlotActivityDTO;
  changed: boolean;
  created: boolean;
};

async function nextAvailableSlotNumber(slotId: string): Promise<number> {
  const match = /(\d+)\s*$/.exec(slotId);
  const parsed = match ? Number(match[1]) : Number.NaN;

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  const lastSlot = await ParkingSlotModel.findOne()
    .sort({ slotNumber: -1 })
    .select("slotNumber")
    .lean();

  return (lastSlot?.slotNumber ?? 0) + 1;
}

/**
 * Applies a slot state change and writes the matching audit log.
 *
 * MQTT messages may reference a slot that has not been provisioned yet, so
 * `createIfMissing` allows the hardware to bootstrap a slot. The REST API
 * keeps this disabled so admins cannot accidentally create arbitrary slots.
 */
export async function applySlotState({
  slotId,
  occupied,
  createIfMissing = false,
  zone,
}: {
  slotId: string;
  occupied: boolean;
  createIfMissing?: boolean;
  zone?: string;
}): Promise<ApplySlotStateResult> {
  await connectDB();

  const normalizedSlotId = slotId.trim().toUpperCase();
  const now = new Date();
  const action: SlotAction = occupied ? "OCCUPIED" : "VACATED";

  const previous = (await ParkingSlotModel.findOneAndUpdate(
    {
      slotId: normalizedSlotId,
      isOccupied: { $ne: occupied },
    },
    {
      $set: {
        isOccupied: occupied,
        lastStateChangedAt: now,
      },
    },
    { returnDocument: "before" },
  ).lean()) as unknown as LeanDocument<ParkingSlot> | null;

  if (!previous) {
    const current = (await ParkingSlotModel.findOne({
      slotId: normalizedSlotId,
    }).lean()) as unknown as LeanDocument<ParkingSlot> | null;

    if (current) {
      return {
        slot: toSlotDTO(current),
        stats: await getParkingStats(),
        changed: false,
        created: false,
      };
    }

    if (!createIfMissing) {
      throw new SlotNotFoundError(normalizedSlotId);
    }

    const slotNumber = await nextAvailableSlotNumber(normalizedSlotId);
    const createdDocument = await ParkingSlotModel.create({
      slotId: normalizedSlotId,
      slotNumber,
      isOccupied: occupied,
      lastStateChangedAt: now,
      ...(zone ? { zone } : {}),
    });

    const createdActivity = await SlotActivityLogModel.create({
      slotId: normalizedSlotId,
      slotNumber,
      action,
      timestamp: now,
    });

    return {
      slot: toSlotDTO(
        createdDocument.toObject() as unknown as LeanDocument<ParkingSlot>,
      ),
      stats: await getParkingStats(),
      activity: toActivityDTO(
        createdActivity.toObject() as unknown as LeanDocument<SlotActivityLog>,
      ),
      changed: true,
      created: true,
    };
  }

  const durationMinutes =
    !occupied && previous.lastStateChangedAt
      ? Math.max(
          0,
          Math.round(
            (now.getTime() - previous.lastStateChangedAt.getTime()) / 60_000,
          ),
        )
      : undefined;

  const activityDocument = await SlotActivityLogModel.create({
    slotId: normalizedSlotId,
    slotNumber: previous.slotNumber,
    action,
    timestamp: now,
    ...(typeof durationMinutes === "number" ? { durationMinutes } : {}),
  });

  const updatedSlot: LeanDocument<ParkingSlot> = {
    ...previous,
    isOccupied: occupied,
    lastStateChangedAt: now,
    updatedAt: now,
  };

  return {
    slot: toSlotDTO(updatedSlot),
    stats: await getParkingStats(),
    activity: toActivityDTO(
      activityDocument.toObject() as unknown as LeanDocument<SlotActivityLog>,
    ),
    changed: true,
    created: false,
  };
}

export async function setSlotOccupancy(input: {
  slotId: string;
  occupied: boolean;
}): Promise<ApplySlotStateResult> {
  return applySlotState({ ...input, createIfMissing: false });
}

export async function getSlotUpdatePayload(
  result: ApplySlotStateResult,
): Promise<SlotUpdatePayload> {
  return { slot: result.slot, stats: result.stats };
}

export async function recordGateEvent({
  gateId,
  event,
  triggeredBy,
}: {
  gateId: string;
  event: GateEvent;
  triggeredBy: GateTrigger;
}): Promise<GateLogDTO> {
  await connectDB();

  const log = await GateLogModel.create({
    gateId: gateId.trim().toUpperCase(),
    event,
    triggeredBy,
  });

  return toGateLogDTO(
    log.toObject() as unknown as LeanDocument<GateLog>,
  );
}

export async function getDashboardSnapshot() {
  const [slotsPage, gateLogs, activityLogs] = await Promise.all([
    listSlots({ page: 1, limit: DEFAULT_PAGE_SIZE }),
    getRecentGateLogs(DEFAULT_LOG_LIMIT),
    getRecentActivityLogs(DEFAULT_LOG_LIMIT),
  ]);

  return { ...slotsPage, gateLogs, activityLogs };
}
