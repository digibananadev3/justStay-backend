import mongoose from "mongoose";

const { Schema } = mongoose;

const walletTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "CREDIT",           // Referral reward
        "DEBIT",            // Withdrawal
        "REFUND_REVERSAL",  // If booking refunded
        "SETTLEMENT",       // Wallet to bank
      ],
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: [
        "REFERRAL_LEVEL_1",
        "REFERRAL_LEVEL_2",
        "REFERRAL_LEVEL_3",
        "REFERRAL_LEVEL_4",
        "ADMIN_ADJUSTMENT",
        "BOOKING_REFUND",
      ],
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    balanceAfter: {
      type: Number,
      required: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "RoomBooking",
    },

    referralId: {
      type: Schema.Types.ObjectId,
      ref: "Referral",
    },

    status: {
      type: String,
      enum: ["completed", "pending", "failed"],
      default: "completed",
    },

    note: {
      type: String,
    },
  },
  { timestamps: true }
);

const WalletTransaction = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });


export default WalletTransaction;