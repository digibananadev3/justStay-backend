import express from "express";
import {
  createRoom,
  updateRoom,
  getAllRooms,
  getRoomById,
  deleteRoom,
  getRoomPricing,
  updateRoomPricing,
  // updateRoomPricePartial,
  updateRoomDiscounts,
  updateRoomPromo,
  bulkUpdateRoomPricing,
  getPropertyRoomsAvailability,
} from "../controllers/propertyRoom.controller.js";

const router = express.Router();

router.post("/", createRoom);        // Create
router.put("/:id", updateRoom);      // Update
router.get("/", getAllRooms);        // Get all
router.get("/:id", getRoomById);     // Get by ID
router.delete("/:id", deleteRoom);   // Delete
router.get("/property/:propertyId/availability", getPropertyRoomsAvailability); // Get availability for all rooms of a property on a specific date

// Pricing & Promotions
router.get("/:id/pricing", getRoomPricing);
router.put("/:id/pricing", updateRoomPricing);
// router.patch("/:id/price", updateRoomPricePartial);
router.patch("/:id/discounts", updateRoomDiscounts);
router.put("/:id/promo", updateRoomPromo);
router.patch("/bulk/pricing", bulkUpdateRoomPricing);

export default router;
