import mongoose from "mongoose";

const { Schema } = mongoose;

const ticketMessageSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    attachments: { type: [String], default: [] },
  },
  { timestamps: true }
);

const SupportTicketMessage = mongoose.model("SupportTicketMessage", ticketMessageSchema);
export default SupportTicketMessage;
