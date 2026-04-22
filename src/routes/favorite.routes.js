import express from "express";
import {
  addToFavorite,
  removeFromFavorite,
  getUserFavorites,
  checkIsFavorite,
} from "../controllers/favorite.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
// import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protect, addToFavorite);
router.get("/", protect, getUserFavorites);
router.get("/check/:propertyId", protect, checkIsFavorite);
router.delete("/:propertyId", protect, removeFromFavorite);

export default router;