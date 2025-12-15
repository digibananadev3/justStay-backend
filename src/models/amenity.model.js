import mongoose from "mongoose";

const { Schema } = mongoose;

const amenitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    category: { type: String, enum: ["room", "property"], default: "room", },
    icon: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const Amenity = mongoose.model("Amenity", amenitySchema);
export default Amenity;
