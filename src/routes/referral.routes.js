import express from "express";
import { applyReferralCode, getEarningsSummary, getReferralStats, getReferralTree } from "../controllers/referral.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/apply-referral", protect, applyReferralCode);
router.get("/referral-tree", protect, getReferralTree);
router.get("/referral-stats", protect, getReferralStats);
router.get("/earnings", protect, getEarningsSummary);

export default router;