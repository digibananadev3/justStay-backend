import express from "express";
import { applyReferralCode, getEarningsSummary, getReferralStats, getReferralTree } from "../controllers/referral.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/apply-referral", applyReferralCode);
router.get("/referral-tree/:userId", getReferralTree);
router.get("/referral-stats/:userId", getReferralStats);
router.get("/earnings", protect, getEarningsSummary);

export default router;