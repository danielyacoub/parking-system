export const SLOT_ACTIONS = ["OCCUPIED", "VACATED"] as const;
export type SlotAction = (typeof SLOT_ACTIONS)[number];

export const GATE_EVENTS = [
  "OPENED",
  "CLOSED",
  "UNAUTHORIZED_ATTEMPT",
] as const;
export type GateEvent = (typeof GATE_EVENTS)[number];

export const GATE_TRIGGERS = [
  "MQTT_SENSOR",
  "ADMIN_OVERRIDE",
  "RFID",
] as const;
export type GateTrigger = (typeof GATE_TRIGGERS)[number];

export type ParkingSlotDTO = {
  id: string;
  slotId: string;
  slotNumber: number;
  isOccupied: boolean;
  lastStateChangedAt: string;
  zone?: string;
};

export type ParkingStats = {
  total: number;
  occupied: number;
  available: number;
  occupancyRate: number;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type SlotsResponse = {
  slots: ParkingSlotDTO[];
  stats: ParkingStats;
  pagination: Pagination;
};

export type SlotActivityDTO = {
  id: string;
  slotId: string;
  slotNumber: number;
  action: SlotAction;
  timestamp: string;
  durationMinutes?: number;
};

export type GateLogDTO = {
  id: string;
  gateId: string;
  event: GateEvent;
  triggeredBy: GateTrigger;
  timestamp: string;
};

export type SlotUpdatePayload = {
  slot: ParkingSlotDTO;
  stats: ParkingStats;
};

export type DashboardSnapshot = {
  slots: ParkingSlotDTO[];
  stats: ParkingStats;
  pagination: Pagination;
  gateLogs: GateLogDTO[];
  activityLogs: SlotActivityDTO[];
};

export type LiveConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

export type ServerToClientEvents = {
  slotUpdate: (payload: SlotUpdatePayload) => void;
  gateLogUpdate: (log: GateLogDTO) => void;
  activityLogUpdate: (log: SlotActivityDTO) => void;
};

export type ClientToServerEvents = Record<string, never>;
