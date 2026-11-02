import { model, models, Schema, type Model } from "mongoose";

import { SLOT_ACTIONS, type SlotAction } from "@/types/parking";

export interface SlotActivityLog {
  slotId: string;
  slotNumber: number;
  action: SlotAction;
  timestamp: Date;
  durationMinutes?: number;
}

const slotActivityLogSchema = new Schema<SlotActivityLog>(
  {
    slotId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    slotNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    action: {
      type: String,
      enum: SLOT_ACTIONS,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    durationMinutes: {
      type: Number,
      min: 0,
    },
  },
  {
    collection: "slot_activity_logs",
    versionKey: false,
  },
);

slotActivityLogSchema.index({ slotId: 1, timestamp: -1 });
slotActivityLogSchema.index({ timestamp: -1 });

export const SlotActivityLogModel: Model<SlotActivityLog> =
  (models.SlotActivityLog as Model<SlotActivityLog> | undefined) ??
  model<SlotActivityLog>("SlotActivityLog", slotActivityLogSchema);
