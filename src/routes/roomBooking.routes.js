import express from "express";
import {
  createRoomBooking,
  updateRoomBooking,
  getRoomBookingById,
  getAllRoomBookings,
  deleteRoomBooking,
} from "../controllers/roomBooking.controller.js";


const router = express.Router();

router.post("/",  createRoomBooking);
router.put("/:id",  updateRoomBooking);
router.get("/:id",  getRoomBookingById);
router.get("/",  getAllRoomBookings);
router.delete("/:id",  deleteRoomBooking);

export default router;
