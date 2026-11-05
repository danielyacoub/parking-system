import mqtt, { type MqttClient } from "mqtt";
import type { Server } from "socket.io";

import { applySlotState, recordGateEvent } from "@/lib/parking";
import {
  GATE_EVENTS,
  GATE_TRIGGERS,
  type ClientToServerEvents,
  type GateEvent,
  type GateTrigger,
  type ServerToClientEvents,
} from "@/types/parking";

type ParkingSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents
>;

const SLOT_TOPIC = /^parking\/slots\/([^/]+)(?:\/(?:state|status))?$/i;
const GATE_TOPIC = /^parking\/gates\/([^/]+)(?:\/(?:event|status))?$/i;

// Legacy ESP32 firmware topics:
//   parking/slot1 ... parking/slot4  (Occupied / Empty)
//   parking/entry/gate, parking/exit/gate  (Open / Closed)
const LEGACY_SLOT_TOPIC = /^parking\/slot([1-9]\d*)$/i;
const LEGACY_GATE_TOPIC = /^parking\/(entry|exit)\/gate$/i;

// The legacy sketch republishes gate status after every reconnect, so keep
// the last state per gate and ignore repeats.
const legacyGateStates = new Map<string, GateEvent>();

function parsePayload(payload: Buffer): unknown {
  const text = payload.toString("utf8").trim();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function normalizeSlotState(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();

    if (["OCCUPIED", "TRUE", "1", "ON", "BUSY"].includes(normalized)) {
      return true;
    }

    if (
      [
        "VACATED",
        "AVAILABLE",
        "FREE",
        "FALSE",
        "0",
        "OFF",
        "VACANT",
        "EMPTY",
      ].includes(normalized)
    ) {
      return false;
    }

    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeSlotState(
      record.occupied ??
        record.isOccupied ??
        record.state ??
        record.status ??
        record.value,
    );
  }

  return undefined;
}

function normalizeGateEvent(value: unknown): GateEvent | undefined {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();

    if (normalized === "OPEN") return "OPENED";
    if (normalized === "CLOSE") return "CLOSED";
    if (normalized === "UNAUTHORIZED") return "UNAUTHORIZED_ATTEMPT";

    return (GATE_EVENTS as readonly string[]).includes(normalized)
      ? (normalized as GateEvent)
      : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeGateEvent(record.event ?? record.state ?? record.status);
  }

  return undefined;
}

function normalizeTrigger(value: unknown): GateTrigger {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();

    if ((GATE_TRIGGERS as readonly string[]).includes(normalized)) {
      return normalized as GateTrigger;
    }
  }

  return "MQTT_SENSOR";
}

async function handleSlotState(
  io: ParkingSocketServer,
  topic: string,
  slotId: string,
  parsed: unknown,
  rawPayload: string,
): Promise<void> {
  const occupied = normalizeSlotState(parsed);

  if (occupied === undefined) {
    console.warn(
      `[mqtt] Ignoring slot message on ${topic}: could not parse occupancy from "${rawPayload}".`,
    );
    return;
  }

  const result = await applySlotState({
    slotId,
    occupied,
    createIfMissing: true,
  });

  if (!result.changed) {
    return;
  }

  io.emit("slotUpdate", { slot: result.slot, stats: result.stats });

  if (result.activity) {
    io.emit("activityLogUpdate", result.activity);
  }

  console.log(
    `[mqtt] ${result.slot.slotId} -> ${
      result.slot.isOccupied ? "OCCUPIED" : "AVAILABLE"
    }${result.created ? " (auto-provisioned)" : ""}`,
  );
}

async function handleMessage(
  io: ParkingSocketServer,
  topic: string,
  payload: Buffer,
  retained: boolean,
): Promise<void> {
  const parsed = parsePayload(payload);

  const slotMatch = SLOT_TOPIC.exec(topic);
  if (slotMatch) {
    await handleSlotState(
      io,
      topic,
      decodeURIComponent(slotMatch[1]),
      parsed,
      payload.toString(),
    );
    return;
  }

  const legacySlotMatch = LEGACY_SLOT_TOPIC.exec(topic);
  if (legacySlotMatch) {
    const slotNumber = Number(legacySlotMatch[1]);
    const slotId = `SLOT-${String(slotNumber).padStart(3, "0")}`;

    await handleSlotState(io, topic, slotId, parsed, payload.toString());
    return;
  }

  const gateMatch = GATE_TOPIC.exec(topic);
  if (gateMatch) {
    const gateId = decodeURIComponent(gateMatch[1]);
    const payloadObject =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    const event = normalizeGateEvent(
      payloadObject?.event ??
        payloadObject?.state ??
        payloadObject?.status ??
        parsed,
    );

    if (!event) {
      console.warn(
        `[mqtt] Ignoring gate message on ${topic}: could not parse event from "${payload.toString()}".`,
      );
      return;
    }

    const log = await recordGateEvent({
      gateId,
      event,
      triggeredBy: normalizeTrigger(payloadObject?.triggeredBy),
    });

    io.emit("gateLogUpdate", log);
    console.log(`[mqtt] ${log.gateId} -> ${log.event} (${log.triggeredBy})`);
    return;
  }

  const legacyGateMatch = LEGACY_GATE_TOPIC.exec(topic);
  if (legacyGateMatch) {
    const gateId =
      legacyGateMatch[1].toLowerCase() === "entry"
        ? "GATE-IN-01"
        : "GATE-OUT-01";
    const event = normalizeGateEvent(parsed);

    if (!event) {
      console.warn(
        `[mqtt] Ignoring legacy gate message on ${topic}: could not parse event from "${payload.toString()}".`,
      );
      return;
    }

    // Retained messages are the broker's last known state. Remember it so a
    // reconnect does not turn that state into a duplicate gate-log entry.
    if (retained) {
      legacyGateStates.set(gateId, event);
      return;
    }

    if (legacyGateStates.get(gateId) === event) {
      return;
    }

    legacyGateStates.set(gateId, event);

    const log = await recordGateEvent({
      gateId,
      event,
      triggeredBy: "MQTT_SENSOR",
    });

    io.emit("gateLogUpdate", log);
    console.log(
      `[mqtt] ${topic} -> ${log.gateId} ${log.event} (legacy firmware)`,
    );
  }
}

export function startMqttListener(
  io: ParkingSocketServer,
): MqttClient | null {
  const url = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";

  let client: MqttClient;

  try {
    client = mqtt.connect(url, {
      clientId:
        process.env.MQTT_CLIENT_ID ??
        `hk-parking-server-${Math.random().toString(16).slice(2, 10)}`,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      clean: true,
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
    });
  } catch (error) {
    console.error(
      "[mqtt] Could not create client:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  client.on("connect", () => {
    const topics = [
      "parking/slots/#",
      "parking/gates/#",
      "parking/slot1",
      "parking/slot2",
      "parking/slot3",
      "parking/slot4",
      "parking/entry/gate",
      "parking/exit/gate",
    ];

    client.subscribe(topics, { qos: 0 }, (error) => {
      if (error) {
        console.error("[mqtt] Subscription failed:", error.message);
        return;
      }

      console.log(`[mqtt] Connected to ${url}; listening on ${topics.join(", ")}`);
    });
  });

  client.on("message", (topic, payload, packet) => {
    void handleMessage(io, topic, payload, packet.retain).catch((error) => {
      console.error(
        `[mqtt] Failed to process ${topic}:`,
        error instanceof Error ? error.message : error,
      );
    });
  });

  client.on("reconnect", () => {
    console.warn("[mqtt] Reconnecting…");
  });

  client.on("offline", () => {
    console.warn("[mqtt] Offline. Waiting for the broker…");
  });

  client.on("error", (error) => {
    console.error("[mqtt] Client error:", error.message);
  });

  return client;
}
