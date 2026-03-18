import express from "express";
import {
  createReview,
  getReviews,
  getReviewById,
  replyToReview,
  deleteReview,
  getPropertyGuestPhotos,
  overallReview,
} from "../controllers/review.controller.js";

const router = express.Router();

router.get("/overallReviews", overallReview);
router.post("/", createReview);
router.get("/", getReviews);
router.get("/:id", getReviewById);
router.post("/:id/reply", replyToReview);
router.delete("/:id", deleteReview);
router.get("/property/:propertyId/photos", getPropertyGuestPhotos);


export default router;
