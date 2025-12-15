import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    type: {
      type: String,
      enum: ["booking", "settlement", "checkin", "checkout", "cancellation", "refund", "announcement", "system"],
      default: "system",
      index: true,
    },
    category: { type: String, trim: true },
    link: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed },

    // status flags
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, isArchived: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
