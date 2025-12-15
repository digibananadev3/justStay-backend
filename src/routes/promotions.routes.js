import express from "express";
import {
  createPromotion,
  listPromotions,
  getPromotionById,
  updatePromotion,
  deletePromotion,
  getDashboardPromotions,
  createSeasonalEvent,
  listSeasonalEvents,
  updateSeasonalEvent,
  deleteSeasonalEvent,
} from "../controllers/promotions.controller.js";

const router = express.Router();

// Promotions
router.post("/promotions", createPromotion);
router.get("/promotions", listPromotions);
router.get("/promotions/:id", getPromotionById);
router.patch("/promotions/:id", updatePromotion);
router.delete("/promotions/:id", deletePromotion);

// Dashboard bundle (active/scheduled/expired + seasonal)
router.get("/dashboard", getDashboardPromotions);

// Seasonal events
router.post("/seasonal", createSeasonalEvent);
router.get("/seasonal", listSeasonalEvents);
router.patch("/seasonal/:id", updateSeasonalEvent);
router.delete("/seasonal/:id", deleteSeasonalEvent);

export default router;
