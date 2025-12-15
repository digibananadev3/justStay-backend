import mongoose from "mongoose";

const { Schema } = mongoose;

const searchHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    query: { type: String, required: true },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

const SearchHistory = mongoose.model("SearchHistory", searchHistorySchema);
export default SearchHistory;
