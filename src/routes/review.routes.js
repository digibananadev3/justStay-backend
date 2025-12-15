import express from "express";
import {
  createReview,
  getReviews,
  getReviewById,
  replyToReview,
  deleteReview,
} from "../controllers/review.controller.js";

const router = express.Router();

router.post("/", createReview);
router.get("/", getReviews);
router.get("/:id", getReviewById);
router.post("/:id/reply", replyToReview);
router.delete("/:id", deleteReview);

export default router;
