import mongoose from "mongoose";

const { Schema } = mongoose;

const timelineSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    status: { type: String },
    note: { type: String },
    referenceId: { type: String },
  },
  { _id: false }
);

const settlementSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "PropertyInfo", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["pending", "processing", "paid", "delayed", "failed"], default: "processing", index: true },
    method: { type: String, enum: ["NEFT", "IMPS", "UPI", "RTGS", "OTHER"], default: "NEFT" },
    settlementType: { type: String, enum: ["auto", "manual"], default: "manual" },

    referenceId: { type: String },
    paidAt: { type: Date },

    bank: {
      ifsc: { type: String },
      accountName: { type: String },
      accountMask: { type: String },
    },

    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true }
);

const Settlement = mongoose.model("Settlement", settlementSchema);
export default Settlement;
