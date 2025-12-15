import path from "path";
import fs from "fs";
import ReportJob from "../models/reportJob.model.js";

// POST /api/reports/generate
export const generateReport = async (req, res) => {
  try {
    const { userId, reportType = "revenue", granularity = "weekly", from, to, format = "csv" } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    const job = await ReportJob.create({ userId, reportType, granularity, from: from ? new Date(`${from}T00:00:00.000Z`) : undefined, to: to ? new Date(`${to}T23:59:59.999Z`) : undefined, format, status: "processing" });

    // Simulate immediate completion with a small CSV stub; replace with real job runner if needed
    const fileName = `rep_${job._id}.${format === "xlsx" ? "xlsx" : "csv"}`;
    const outDir = path.join(process.cwd(), "uploads", "reports");
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, "type,granularity,from,to\n" + `${reportType},${granularity},${from || ""},${to || ""}\n`, "utf8");

    job.status = "completed";
    await job.save();

    res.status(202).json({ success: true, message: "Report started", data: { jobId: String(job._id), status: job.status, reportType: job.reportType } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/reports/status/:jobId
export const getReportStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await ReportJob.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Report job not found" });
    const file = `rep_${job._id}.${job.format === "xlsx" ? "xlsx" : "csv"}`;
    res.status(200).json({ success: true, data: { jobId: String(job._id), status: job.status, downloadUrl: job.status === "completed" ? `/api/reports/download/${file}` : null } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/reports/download/:file
export const downloadReport = async (req, res) => {
  try {
    const { file } = req.params;
    const filePath = path.join(process.cwd(), "uploads", "reports", file);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: "File not found" });
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
