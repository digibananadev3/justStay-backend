import express from "express";
import { getRevenueSummary, getRevenueFeed, getRevenueList, getBookingRevenueDetail } from "../controllers/revenue.controller.js";

const router = express.Router();

router.get("/summary", getRevenueSummary);
router.get("/feed", getRevenueFeed);
router.get("/list", getRevenueList);
router.get("/booking/:bookingId", getBookingRevenueDetail);

export default router;
