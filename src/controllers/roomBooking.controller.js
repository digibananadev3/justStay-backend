import RoomBooking from "../models/roomBooking.model.js";
import RoomInventory from "../models/roomInventory.model.js";
import mongoose from "mongoose";

const timeToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const isOverlap = (aStart, aEnd, bStart, bEnd) => {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
};

// ======================================================
// 🟢 CREATE ROOM BOOKING
// ======================================================
// export const createRoomBooking = async (req, res) => {
//   try {
//     const userId = req.userId || req.body.userId;
//     // const { propertyId } = req.body;
//      const { propertyId, roomId, date, checkInTime, plan } = req.body;

//     // if (!userId || !propertyId) {
//     //   return res.status(400).json({
//     //     success: false,
//     //     message: "Both userId and propertyId are required",
//     //   });
//     // }

//     if (!userId || !propertyId || !roomId || !date || !checkInTime || !plan) {
//       return res.status(400).json({ success: false, message: "Missing fields" });
//     }

//     const bookingData = { ...req.body, userId, propertyId };

//     const newBooking = await RoomBooking.create(bookingData);

//     res.status(201).json({
//       success: true,
//       message: "Room booking created successfully",
//       data: newBooking,
//     });
//   } catch (error) {
//     console.error("Error creating booking:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while creating booking",
//       error: error.message,
//     });
//   }
// };

// Modified createRoomBooking with inventory locking
export const createRoomBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId || req.body.userId;
    const { propertyId, roomId, date, checkInTime, plan } = req.body;

    if (!userId || !propertyId || !roomId || !date || !checkInTime || !plan) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
    }

    let duration;
    if (plan === "3hr") duration = 180;
    else if (plan === "6hr") duration = 360;
    else if (plan === "night")
      duration = 900; // 7PM–10AM logic still in inventory
    else
      return res.status(400).json({ success: false, message: "Invalid plan" });

    const startMin = timeToMinutes(checkInTime);
    const endMin = startMin + duration;
    const endTime =
      String(Math.floor(endMin / 60)).padStart(2, "0") +
      ":" +
      String(endMin % 60).padStart(2, "0");

    const invDate = new Date(`${date}T00:00:00.000Z`);

    let inventory = await RoomInventory.findOne({
      roomId,
      date: invDate,
    }).session(session);

    if (!inventory) {
      inventory = new RoomInventory({ roomId, date: invDate, timeBlocks: [] });
    }

    for (const b of inventory.timeBlocks) {
      if (
        isOverlap(startMin, endMin, timeToMinutes(b.from), timeToMinutes(b.to))
      ) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "Room already booked for this slot",
        });
      }
    }

    const booking = await RoomBooking.create(
      [{ ...req.body, userId, propertyId }],
      { session },
    );

    inventory.timeBlocks.push({
      from: checkInTime,
      to: endTime,
      plan,
      bookingId: booking[0]._id,
    });

    await inventory.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Room booked & slot locked",
      data: booking[0],
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Booking failed",
      error: err.message,
    });
  }
};



// ======================================================
// 🟡 UPDATE ROOM BOOKING
// ======================================================
export const updateRoomBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedBooking = await RoomBooking.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Room booking updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating booking",
      error: error.message,
    });
  }
};

// ======================================================
// 🟣 GET BOOKING BY ID
// ======================================================
export const getRoomBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await RoomBooking.findById(id)
      .populate("userId", "firstName lastName email phone")
      .populate("propertyId", "basicPropertyDetails.name propertyType");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking details fetched successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error fetching booking by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching booking",
      error: error.message,
    });
  }
};

// ======================================================
// 🟤 GET ALL BOOKINGS (filter by userId/propertyId/status)
// ======================================================
// Booking Status
// Booked = upcoming
// checkin = ongoing
// checkout = past Booking || completed
// cancel = cancelled || Booked online but cancelled before checkin
export const getAllRoomBookings = async (req, res) => {
  try {
    const { userId, propertyId, status } = req.query;
    const filter = {};

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }

    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    }

    if (status) filter.status = status;

    const bookings = await RoomBooking.find(filter)
      .populate("userId", "firstName lastName email phone")
      .populate("propertyId", "basicPropertyDetails.name propertyType");

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ======================================================
// 🔴 DELETE BOOKING
// ======================================================
export const deleteRoomBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await RoomBooking.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Room booking deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting booking",
      error: error.message,
    });
  }
};
