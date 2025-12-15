import express from "express";
import { generateReport, getReportStatus, downloadReport } from "../controllers/reports.controller.js";

const router = express.Router();

router.post("/generate", generateReport);
router.get("/status/:jobId", getReportStatus);
router.get("/download/:file", downloadReport);

export default router;
