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
  getFoodsByRestaurant,
  getFoodById,
  updateFood,
  deleteFood,
  assignFoodToRoom,
  getSpecificRoomOrders,
//   cancelPropertyFoodOrder,
//   deleteFood,

//   // Property Food
// //   assignFood,
//   getSpecificPropertyFood,
//   getRestaurantStock,
//   updateStock,
//   removeFood,

//   // Room Food
//   createRoomFoodOrder,
//   getFoodById
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
router.post("/restaurant/:restaurantId/foods", createFood);
router.get("/foods", getAllFoods);
router.get("/restaurant/:restaurantId/foods", getFoodsByRestaurant);
router.get("/foods/:id", getFoodById);
router.put("/update/foods/:id", updateFood);
router.delete("/delete/food/:id", deleteFood);


/* =========================
   PROPERTY Room FOOD
========================= */
router.post("/assign/food", assignFoodToRoom);
router.get("/roomFood/:roomId", getSpecificRoomOrders);
// router.get("/cancel/food/:id", cancelPropertyFoodOrder);

export default router;
