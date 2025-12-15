import mongoose from "mongoose";

const { Schema } = mongoose;

const reportJobSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    reportType: { type: String, enum: ["revenue", "settlement", "payout"], required: true },
    granularity: { type: String, enum: ["daily", "weekly", "monthly", "yearly"], default: "daily" },
    from: { type: Date },
    to: { type: Date },
    format: { type: String, enum: ["csv", "xlsx"], default: "csv" },
    status: { type: String, enum: ["queued", "processing", "completed", "failed"], default: "queued", index: true },
    error: { type: String },
  },
  { timestamps: true }
);

const ReportJob = mongoose.model("ReportJob", reportJobSchema);
export default ReportJob;
