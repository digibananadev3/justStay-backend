import mongoose from "mongoose";

const { Schema } = mongoose;

const kbCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const SupportKBCategory = mongoose.model("SupportKBCategory", kbCategorySchema);
export default SupportKBCategory;
