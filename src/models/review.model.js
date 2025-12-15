import mongoose from "mongoose";

const { Schema } = mongoose;

const replySchema = new Schema(
  {
    message: { type: String, trim: true },
    repliedBy: { type: Schema.Types.ObjectId, ref: "User" },
    repliedAt: { type: Date },
  },
  { _id: false }
);

const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "PropertyInfo", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "PropertyRoom" },
    bookingId: { type: Schema.Types.ObjectId, ref: "RoomBooking" },

    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000 },
    images: { type: [String], default: [] },

    reply: replySchema,

    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", reviewSchema);
export default Review;
