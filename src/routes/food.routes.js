import express from "express";
import {
  // Restaurant
  createRestaurant,
  getAllRestaurants,
  getSpecificRestaurant,
  deleteRestaurant,

  // Food
  createFood,
  getAllFoods,
  deleteFood,

  // Property Food
  assignFood,
  getSpecificPropertyFood,
  getRestaurantStock,
  updateStock,
  removeFood,

  // Room Food
  createRoomFoodOrder,
  getFoodById
} from "../controllers/food.controller.js";

const router = express.Router();

/* =========================
   RESTAURANT ROUTES
========================= */
router.post("/restaurants", createRestaurant);
router.get("/restaurants", getAllRestaurants);
router.get("/restaurants/:id", getSpecificRestaurant);
router.delete("/restaurants/:id", deleteRestaurant);

/* =========================
   GLOBAL FOOD ROUTES
========================= */
router.post("/foods", createFood);
router.get("/foods", getAllFoods);
router.get("/foods/:id", getFoodById);
router.delete("/foods/:id", deleteFood);


/* =========================
   PROPERTY → RESTAURANT FOOD
========================= */
router.post("/property-food", assignFood);
router.get("/property-food/property/:id", getSpecificPropertyFood);
router.get("/property-food/restaurant/:restaurantId", getRestaurantStock);
router.put("/property-food/:id", updateStock);
router.delete("/property-food/:id", removeFood);

/* =========================
   ROOM FOOD ORDER
========================= */
router.post("/room-food", createRoomFoodOrder);

export default router;
