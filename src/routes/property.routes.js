import express from "express";
import {
  createOrUpdateProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  sortAndFilterProperties,
  getTopPicksForUser,
  setPropertyCoordinates,
  getSimilarProperties,
} from "../controllers/property.controller.js";

// import { protect, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// -----------------------------
// Routes
// -----------------------------
router.get("/filter", sortAndFilterProperties); // search properties (can be enhanced with query params)
router.get("/top-picks", getTopPicksForUser); // get top picks for user (can be enhanced with user context)
router.post("/setPropertyCoordinates", setPropertyCoordinates); // set property coordinates (can be enhanced with geocoding integration)
router.post("/",  createOrUpdateProperty); // create property
router.get("/", getAllProperties); // list all properties
router.get("/:id", getPropertyById); // single property
router.put("/:id", updateProperty); // update property
router.delete("/:id", deleteProperty); // delete property
router.get("/similarProperties/:propertyId", getSimilarProperties); // get similar properties (can be enhanced with similarity logic)



export default router;
