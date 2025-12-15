import mongoose from "mongoose";

const { Schema } = mongoose;

const chatSessionSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    relatedTicketId: { type: Schema.Types.ObjectId, ref: "SupportTicket" },
    topic: { type: String, trim: true },
    status: { type: String, enum: ["Open", "Closed"], default: "Open" }
  },
  { timestamps: true }
);

const SupportChatSession = mongoose.model("SupportChatSession", chatSessionSchema);
export default SupportChatSession;
