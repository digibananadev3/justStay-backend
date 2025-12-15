import mongoose from "mongoose";

const { Schema } = mongoose;

const timelineSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    action: { type: String },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const cancellationSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "RoomBooking", required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "PropertyInfo", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    status: {
      type: String,
      enum: [
        "Initiated",          // customer requested
        "UnderReview",        // hotelier/admin reviewing
        "Approved",           // approved for refund
        "Denied",             // denied
        "RefundInProgress",   // payout initiated
        "Refunded"            // completed
      ],
      default: "Initiated",
      index: true,
    },

    reason: { type: String, trim: true },
    policy: { type: String, trim: true },

    priceSummary: {
      basePrice: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      taxAndFees: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
      currency: { type: String, default: "INR" }
    },

    calculation: {
      cancellationFee: { type: Number, default: 0 },
      refundableAmount: { type: Number, default: 0 },
    },

    payout: {
      method: { type: String, enum: ["Original", "BankTransfer", "Wallet"], default: "Original" },
      transactionId: { type: String },
      paidAt: { type: Date },
      notes: { type: String }
    },

    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true }
);

const Cancellation = mongoose.model("Cancellation", cancellationSchema);
export default Cancellation;
