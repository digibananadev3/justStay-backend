import express from "express";
import { listSettlements, getSettlementById, settleNow, updateSettlementStatus } from "../controllers/settlements.controller.js";

const router = express.Router();

router.get("/", listSettlements);
router.get("/:id", getSettlementById);
router.post("/settle-now", settleNow);
router.post("/:id/status", updateSettlementStatus);

export default router;
