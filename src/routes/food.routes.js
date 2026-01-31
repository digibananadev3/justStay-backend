import express from "express";
import { assignFood, createFood, createRestaurant, deleteFood, deleteRestaurant, getAllFoods, getAllRestaurants, getRestaurantStock, getSpecificPropertyFood, getSpecificRestaurant } from "../controllers/food.controller.js";
const router = express.Router();



router.post("/create-restaurant", createRestaurant);
router.get("/get-all-restaurants", getAllRestaurants);
router.get("/get/:id", getSpecificRestaurant);
router.delete("/delete-restaurant/:id", deleteRestaurant);



router.post("/create-food", createFood);
router.get("/get-all-foods", getAllFoods);
router.delete("/delete-food/:id", deleteFood);


router.post("/property-food", assignFood);
router.get("/restaurant-stock/:restaurantId", getRestaurantStock);
router.get("/property-food/property/:id", getSpecificPropertyFood);

export default router;