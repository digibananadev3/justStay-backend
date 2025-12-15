import mongoose from "mongoose";

const { Schema } = mongoose;

const promotionSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "PropertyInfo", index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    promoCode: { type: String, trim: true, index: true },

    kind: { type: String, enum: ["percent", "flat"], default: "percent" },
    discountPercent: { type: Number, min: 0, max: 100 },
    flatAmount: { type: Number, min: 0 },

    appliesTo: {
      roomIds: { type: [Schema.Types.ObjectId], ref: "PropertyRoom", default: [] },
      plans: { type: [String], default: [] },
      weekdays: { type: [String], default: [] },
      minNights: { type: Number, default: 0 },
      audience: { type: String, enum: ["all", "new_customers"], default: "all" },
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["Scheduled", "Active", "Paused", "Expired"], default: "Scheduled", index: true },
    isStackable: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },

    metrics: {
      bookings: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      lastUpdated: { type: Date },
    },
  },
  { timestamps: true }
);

promotionSchema.index({ propertyId: 1, status: 1, startDate: -1 });

const Promotion = mongoose.model("Promotion", promotionSchema);
export default Promotion;
