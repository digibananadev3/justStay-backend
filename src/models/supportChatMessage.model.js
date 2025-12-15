import mongoose from "mongoose";

const { Schema } = mongoose;

const chatMessageSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "SupportChatSession", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    attachments: { type: [String], default: [] }
  },
  { timestamps: true }
);

const SupportChatMessage = mongoose.model("SupportChatMessage", chatMessageSchema);
export default SupportChatMessage;
