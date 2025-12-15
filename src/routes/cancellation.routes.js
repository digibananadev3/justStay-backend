import express from "express";
import {
  initiateCancellation,
  listCancellations,
  getCancellationById,
  reviewCancellation,
  initiateRefund,
  completeRefund,
  updateCalculation,
} from "../controllers/cancellation.controller.js";

const router = express.Router();

router.post("/", initiateCancellation);
router.get("/", listCancellations);
router.get("/:id", getCancellationById);
router.post("/:id/review", reviewCancellation);
router.post("/:id/refund/initiate", initiateRefund);
router.post("/:id/refund/complete", completeRefund);
router.patch("/:id/calc", updateCalculation);

export default router;
