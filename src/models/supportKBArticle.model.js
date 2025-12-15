import mongoose from "mongoose";

const { Schema } = mongoose;

const kbArticleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    summary: { type: String, trim: true },
    content: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: "SupportKBCategory", required: true },
    tags: { type: [String], default: [] },
    published: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const SupportKBArticle = mongoose.model("SupportKBArticle", kbArticleSchema);
export default SupportKBArticle;
