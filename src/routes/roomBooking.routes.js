import express from "express";
import {
  createRoomBooking,
  updateRoomBooking,
  getRoomBookingById,
  getAllRoomBookings,
  deleteRoomBooking,
  updateBookingStatusAndPayment,
  getUserBookings,
  guestCheckInForm,
  getAllBookedSlotsForRoom,
  cancelRoomBooking,
  getPropertyStats,
  // getAllRoomOfSpecificProperty,
} from "../controllers/roomBooking.controller.js";


const router = express.Router();


router.delete("/cancel/booking/:bookingId", cancelRoomBooking);

router.post("/",  createRoomBooking);
router.put("/:id",  updateRoomBooking);
router.get("/:id",  getRoomBookingById);
router.get("/",  getAllRoomBookings);
// router.get("/property/:propertyId", getAllRoomOfSpecificProperty);
router.get("/room/:roomId", getAllBookedSlotsForRoom); // Get all booked slots for a specific room (can be enhanced with date filtering)
router.delete("/:id",  deleteRoomBooking);
router.put("/updateBookingStatus/:bookingId", updateBookingStatusAndPayment);
router.get("/user/:userId/bookings", getUserBookings);
router.patch("/guest/:bookingId/checkin", guestCheckInForm);

router.get("/property/:propertyId/stats", getPropertyStats);


export default router;
