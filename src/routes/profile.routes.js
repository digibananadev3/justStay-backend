import express from "express";
import { getProfile, updateUserProfile, updatePropertyCard, getProfileSummary } from "../controllers/profile.controller.js";

const router = express.Router();

router.get("/", getProfile); // ?userId=
router.put("/", updateUserProfile);
router.put("/property/:id", updatePropertyCard);
router.get("/summary", getProfileSummary); // ?userId=

export default router;
