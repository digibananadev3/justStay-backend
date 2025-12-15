import mongoose from "mongoose";

const { Schema } = mongoose;

const roomRateSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "PropertyRoom", required: true, index: true },
    date: { type: Date, required: true, index: true },
    plan: { type: String, enum: ["RO", "CP", "MAP", "AP", "OTHER"], required: true },
    price: { type: Number, required: true, min: 0 },
    extraAdultPrice: { type: Number, default: 0, min: 0 },
    extraChildPrice: { type: Number, default: 0, min: 0 },
    taxIncluded: { type: Boolean, default: true },
    currency: { type: String, default: "INR" },
    overrideLevel: { type: String, enum: ["base", "seasonal", "override"], default: "override" }
  },
  { timestamps: true }
);

roomRateSchema.index({ roomId: 1, date: 1, plan: 1, overrideLevel: 1 }, { unique: true });

const RoomRate = mongoose.model("RoomRate", roomRateSchema);
export default RoomRate;
