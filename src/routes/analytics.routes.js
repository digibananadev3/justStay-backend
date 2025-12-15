import express from "express";
import { getAnalyticsSummary } from "../controllers/analytics.controller.js";

const router = express.Router();

// period: today | this_week | this_month | custom
// if period=custom, provide from, to (YYYY-MM-DD)
router.get("/summary", getAnalyticsSummary);

export default router;
