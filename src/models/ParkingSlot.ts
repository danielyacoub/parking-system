import { model, models, Schema, type Model } from "mongoose";

export interface ParkingSlot {
  slotId: string;
  slotNumber: number;
  isOccupied: boolean;
  lastStateChangedAt: Date;
  zone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const parkingSlotSchema = new Schema<ParkingSlot>(
  {
    slotId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    slotNumber: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },
    isOccupied: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastStateChangedAt: {
      type: Date,
      default: Date.now,
    },
    zone: {
      type: String,
      trim: true,
      maxlength: 64,
    },
  },
  {
    collection: "parking_slots",
    timestamps: true,
    versionKey: false,
  },
);

parkingSlotSchema.index({ zone: 1, slotNumber: 1 });

export const ParkingSlotModel: Model<ParkingSlot> =
  (models.ParkingSlot as Model<ParkingSlot> | undefined) ??
  model<ParkingSlot>("ParkingSlot", parkingSlotSchema);
