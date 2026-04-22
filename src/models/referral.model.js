import mongoose from "mongoose";

const { Schema } = mongoose;

const referralSchema = new Schema(
  {
     // Who receives reward
    referrerId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true,
    },

    // Who generated the booking
    refereeId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },

      // MLM level (1–4)
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },

    // Which booking generated reward
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "RoomBooking",
      required: true,
      index: true,
    },

    // Reward amount credited
    rewardAmount: { 
      type: Number,
      required: true,
      min: 0,
      // default: 0 
    },
    status: { 
      type: String, 
      enum: ["Pending", "Active", "Inactive"], 
      default: "Pending" 
    },
    joinedAt: { type: Date },
  },
  { timestamps: true }
);

// referralSchema.index({ referrerId: 1, refereeId: 1 }, { unique: true });

// CRITICAL: Prevent duplicate reward per level per booking
referralSchema.index(
  { referrerId: 1, refereeId: 1, bookingId: 1, level: 1 },
  { unique: true }
);


const Referral = mongoose.model("Referral", referralSchema);
export default Referral;
