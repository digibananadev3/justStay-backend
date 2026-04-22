import express from "express";
import { createOffer, getGuestOffersSummary, getOffersYouWillLike } from "../controllers/offers.controller.js";

const router = express.Router();


router.post("/create", createOffer);
router.get("/offersYouLike", getOffersYouWillLike);
router.get("/getOffersSummary/:id", getGuestOffersSummary);


export default router;
