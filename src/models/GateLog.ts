import { model, models, Schema, type Model } from "mongoose";

import {
  GATE_EVENTS,
  GATE_TRIGGERS,
  type GateEvent,
  type GateTrigger,
} from "@/types/parking";

export interface GateLog {
  gateId: string;
  event: GateEvent;
  triggeredBy: GateTrigger;
  timestamp: Date;
}

const gateLogSchema = new Schema<GateLog>(
  {
    gateId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    event: {
      type: String,
      enum: GATE_EVENTS,
      required: true,
    },
    triggeredBy: {
      type: String,
      enum: GATE_TRIGGERS,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "gate_logs",
    versionKey: false,
  },
);

gateLogSchema.index({ timestamp: -1 });
gateLogSchema.index({ gateId: 1, timestamp: -1 });

export const GateLogModel: Model<GateLog> =
  (models.GateLog as Model<GateLog> | undefined) ??
  model<GateLog>("GateLog", gateLogSchema);
