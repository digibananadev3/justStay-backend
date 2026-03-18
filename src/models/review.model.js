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


const ratingBreakdownSchema = new Schema(
  {
    cleanliness: { type: Number, min: 1, max: 5, required: true },
    location: { type: Number, min: 1, max: 5, required: true },
    staffBehaviour: { type: Number, min: 1, max: 5, required: true },
    valueForMoney: { type: Number, min: 1, max: 5, required: true },
  },
  { _id: false }
);



const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "PropertyInfo", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "PropertyRoom" },
    bookingId: { type: Schema.Types.ObjectId, ref: "RoomBooking" },

    // Overall rating (calculated from breakdown)
    rating: { type: Number, min: 1, max: 5, required: true },

    // Category ratings
    ratings: ratingBreakdownSchema,
    comment: { type: String, trim: true, maxlength: 1000 },
    images: { type: [String], default: [] },

    reply: replySchema,

    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

reviewSchema.index({ propertyId: 1 });
reviewSchema.index({ propertyId: 1, isPublished: 1 });
reviewSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { bookingId: { $exists: true } } }
);


const Review = mongoose.model("Review", reviewSchema);
export default Review;
