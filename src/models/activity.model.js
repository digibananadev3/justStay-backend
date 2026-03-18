import mongoose from "mongoose";

const { Schema } = mongoose;

const activitySchema = new Schema(
  {
    // userId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    // type: { type: String, required: true },
    // description: { type: String, required: true },
    // meta: { type: Schema.Types.Mixed },


    userId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      index: true, 
      required: true 
    },

    type: { 
      type: String, 
      enum: [
        "REFERRAL_REWARD",
        "BOOKING_COMMISSION",
        "WALLET_CREDIT",
        "WALLET_DEBIT",
        "SETTLEMENT_REQUEST",
        "SETTLEMENT_PAID"
      ],
      required: true,
      index: true
    },

    amount: { 
      type: Number, 
      default: 0 
    },

    currency: { 
      type: String, 
      default: "INR" 
    },

    bookingId: { 
      type: Schema.Types.ObjectId, 
      ref: "RoomBooking" 
    },

    referralId: { 
      type: Schema.Types.ObjectId, 
      ref: "Referral" 
    },

    description: { 
      type: String 
    },

    meta: { 
      type: Schema.Types.Mixed 
    },
  },
  { timestamps: true }
);

const Activity = mongoose.model("Activity", activitySchema);
export default Activity;
