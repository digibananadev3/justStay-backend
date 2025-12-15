import mongoose from "mongoose";

const { Schema } = mongoose;

const roomTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const RoomType = mongoose.model("RoomType", roomTypeSchema);
export default RoomType;
