import "./load-env";

import { connectDB, disconnectDB } from "../src/lib/db";
import { GateLogModel } from "../src/models/GateLog";
import { ParkingSlotModel } from "../src/models/ParkingSlot";
import { SlotActivityLogModel } from "../src/models/SlotActivityLog";

/**
 * Resets the database to the four hardware-linked bays.
 *
 * The ESP32 drives SLOT-001 … SLOT-004 plus the entry and exit gates. There
 * is no demo/simulated data: occupancy, slot activity, and gate logs are
 * populated only by live MQTT messages after this reset.
 */
const HARDWARE_SLOTS = [
  { slotId: "SLOT-001", slotNumber: 1, zone: "Zone A" },
  { slotId: "SLOT-002", slotNumber: 2, zone: "Zone A" },
  { slotId: "SLOT-003", slotNumber: 3, zone: "Zone A" },
  { slotId: "SLOT-004", slotNumber: 4, zone: "Zone A" },
] as const;

async function seed() {
  console.log("[seed] Connecting to MongoDB…");
  await connectDB();

  console.log("[seed] Clearing parking_slots, slot_activity_logs, gate_logs…");
  await Promise.all([
    ParkingSlotModel.deleteMany({}),
    SlotActivityLogModel.deleteMany({}),
    GateLogModel.deleteMany({}),
  ]);

  const now = new Date();

  await ParkingSlotModel.insertMany(
    HARDWARE_SLOTS.map((slot) => ({
      ...slot,
      isOccupied: false,
      lastStateChangedAt: now,
    })),
  );

  console.log(`[seed] Inserted ${HARDWARE_SLOTS.length} hardware slots.`);
  console.log("[seed] No demo activity or gate logs were inserted.");
  console.log(
    "[seed] Done. Waiting for the ESP32 to publish live slot and gate state.",
  );
}

seed()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[seed] Failed:", error);
    await disconnectDB().catch(() => undefined);
    process.exit(1);
  });
