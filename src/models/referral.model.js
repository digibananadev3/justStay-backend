import mongoose from "mongoose";

const { Schema } = mongoose;

const referralSchema = new Schema(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    refereeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["Pending", "Active", "Inactive"], default: "Pending" },
    rewardAmount: { type: Number, default: 0 },
    joinedAt: { type: Date },
  },
  { timestamps: true }
);

referralSchema.index({ referrerId: 1, refereeId: 1 }, { unique: true });

const Referral = mongoose.model("Referral", referralSchema);
export default Referral;
