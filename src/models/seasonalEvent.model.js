import mongoose from "mongoose";

const { Schema } = mongoose;

const seasonalEventSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "PropertyInfo", index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    multiplier: { type: Number, required: true, min: 0 }, // e.g., 2.5x pricing
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["Scheduled", "Active", "Expired", "Paused"], default: "Scheduled", index: true },
    priority: { type: Number, default: 0 },
    metrics: {
      bookings: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      lastUpdated: { type: Date },
    },
  },
  { timestamps: true }
);

seasonalEventSchema.index({ propertyId: 1, status: 1, startDate: -1 });

const SeasonalEvent = mongoose.model("SeasonalEvent", seasonalEventSchema);
export default SeasonalEvent;
