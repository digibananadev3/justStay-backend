import express from "express";
import {
  createOrUpdateProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
} from "../controllers/property.controller.js";

// import { protect, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// -----------------------------
// Routes
// -----------------------------
router.post("/",  createOrUpdateProperty); // create property
router.get("/", getAllProperties); // list all properties
router.get("/:id", getPropertyById); // single property
router.put("/:id", updateProperty); // update property
router.delete("/:id", deleteProperty); // delete property

export default router;
