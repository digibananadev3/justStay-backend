import mongoose from "mongoose";

const { Schema } = mongoose;

const referralConfigSchema = new Schema(
  {
    level1Percentage: {
      type: Number,
      required: true,
      default: 10, // 10%
    },

    level2Percentage: {
      type: Number,
      required: true,
      default: 5,
    },

    level3Percentage: {
      type: Number,
      required: true,
      default: 3,
    },

    level4Percentage: {
      type: Number,
      required: true,
      default: 2,
    },

    minBookingAmount: {
      type: Number,
      default: 1000,
    },

    maxRewardCap: {
      type: Number,
      default: 10000,
    },

    rewardReleaseDelayDays: {
      type: Number,
      default: 1, // release after checkout + 1 day
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const ReferralConfig = mongoose.model(
  "ReferralConfig",
  referralConfigSchema
);

export default ReferralConfig;