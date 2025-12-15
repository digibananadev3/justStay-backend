import mongoose from "mongoose";

const { Schema } = mongoose;

const ticketSchema = new Schema(
  {
    ticketNo: { type: String},
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignee: { type: Schema.Types.ObjectId, ref: "User" },
    category: { type: String, enum: ["Payout", "GuestComplaint", "BookingProblem", "TechnicalIssue", "Other"], required: true },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Low" },
    status: { type: String, enum: ["New", "Open", "InProgress", "WaitingOnCustomer", "Resolved", "Closed"], default: "New" },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "RoomBooking" },
    attachments: { type: [String], default: [] },
    timeline: [
      {
        at: { type: Date },
        action: { type: String },
        by: { type: Schema.Types.ObjectId, ref: "User" },
        meta: { type: Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true }
);

const SupportTicket = mongoose.model("SupportTicket", ticketSchema);
export default SupportTicket;
