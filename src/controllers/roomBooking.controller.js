import mongoose from "mongoose";
import PropertyRoom from "../models/propertyRoom.model.js";
import RoomInventory from "../models/roomInventory.model.js";
import RoomBooking from "../models/roomBooking.model.js";
import Offer from "../models/offer.model.js";
import rewardService from "../services/reward.service.js";

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
export const createRoomBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId || req.body.userId;

    const {
      propertyId,
      roomId,
      date,
      checkInTime,
      plan,
      mealType = "roomOnly",

      // Guest details
      salutation,
      firstName,
      lastName,
      email,
      phone,

      // Occupancy
      adults = 1,
      children = 0,

      // Coupon
      couponCode,
    } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------
    if (!userId || !propertyId || !roomId || !date || !checkInTime || !plan) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!firstName || !phone) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Guest name and phone are required",
      });
    }

    // -------------------------------------------------
    // FETCH ROOM
    // -------------------------------------------------
    const room = await PropertyRoom.findById(roomId).session(session);

    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // -------------------------------------------------
    // PLAN LOGIC
    // -------------------------------------------------
    let stayType;
    let duration;

    switch (plan) {
      case "3hr":
        stayType = "threeHours";
        duration = 180;
        break;
      case "6hr":
        stayType = "sixHours";
        duration = 360;
        break;
      case "night":
        stayType = "oneNight";
        duration = room.defaultNightDuration || 720;
        break;
      default:
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid plan selected",
        });
    }

    // -------------------------------------------------
    // PRICING
    // -------------------------------------------------
    if (!room.pricing?.[stayType]?.[mealType]) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Pricing configuration error",
      });
    }

    const basePrice = room.pricing[stayType][mealType];
    const discountPercent = room.discounts?.[`${stayType}Percent`] || 0;
    const discountAmount = (basePrice * discountPercent) / 100;
    const finalRoomPrice = basePrice - discountAmount;

    // -------------------------------------------------
    // COUPON / OFFER LOGIC
    // -------------------------------------------------
    let couponDiscount = 0;
    let appliedCoupon = null;
    let offerDoc = null;

    if (couponCode) {
      const now = new Date();

      // offerDoc = await Offer.findOne({
      //   promoCode: couponCode.toUpperCase(),
      //   isActive: true,
      //   validFrom: { $lte: now },
      //   validUntil: { $gte: now },
      // }).session(session);

      offerDoc = await Offer.findOne({
        promoCode: couponCode.toUpperCase(),
        isActive: true,
        // validFrom: { $lte: now },
        // validUntil: { $gte: now },
      });



      // Not found or expired
      if (!offerDoc) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid or expired promo code",
        });
      }

      // Usage limit exceeded
      if (offerDoc.usageLimit && offerDoc.usedCount >= offerDoc.usageLimit) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Promo code usage limit reached",
        });
      }

      // Property restriction check
      if (offerDoc.properties?.length > 0) {
        const isValidForProperty = offerDoc.properties
          .map(String)
          .includes(String(propertyId));

        if (!isValidForProperty) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Promo code not valid for this property",
          });
        }
      }

      // Minimum amount check
      if (offerDoc.minAmount && finalRoomPrice < offerDoc.minAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Minimum booking amount of ₹${offerDoc.minAmount} required for this promo code`,
        });
      }

      // Calculate discount based on type
      if (offerDoc.discountType === "percentage") {
        couponDiscount = (finalRoomPrice * offerDoc.discountValue) / 100;
      } else if (offerDoc.discountType === "fixed") {
        couponDiscount = offerDoc.discountValue;
      } else if (offerDoc.discountType === "free_night") {
        couponDiscount = finalRoomPrice; // full room price waived
      }

      // Discount should never exceed room price
      couponDiscount = Math.min(couponDiscount, finalRoomPrice);
      couponDiscount = parseFloat(couponDiscount.toFixed(2));

      appliedCoupon = {
        offerId: offerDoc._id,
        code: offerDoc.promoCode,
        discountAmount: couponDiscount,
      };
    }

    // -------------------------------------------------
    // FINAL PRICE CALCULATION
    // -------------------------------------------------
    const totalDiscount = discountAmount + couponDiscount;
    const priceAfterDiscount = finalRoomPrice - couponDiscount;
    const tax = parseFloat((priceAfterDiscount * 0.12).toFixed(2));
    const platformFee = 50;
    const totalAmount = parseFloat(
      (priceAfterDiscount + tax + platformFee).toFixed(2)
    );

    const priceSummary = {
      roomPrice: basePrice,
      foodPrice: 0,
      taxAndServiceFees: tax,
      discount: parseFloat(totalDiscount.toFixed(2)),
      platformFee,
      totalAmount,
    };

    // -------------------------------------------------
    // TIME CALCULATION (MIDNIGHT SAFE)
    // -------------------------------------------------
    const startMin = timeToMinutes(checkInTime);
    const endMin = startMin + duration;

    const endHour = Math.floor(endMin / 60) % 24;
    const endMinute = endMin % 60;

    const endTime =
      String(endHour).padStart(2, "0") +
      ":" +
      String(endMinute).padStart(2, "0");

    const invDate = new Date(`${date}T00:00:00.000Z`);

    const checkoutDate =
      endMin >= 1440
        ? new Date(invDate.getTime() + 24 * 60 * 60 * 1000)
        : invDate;

    // -------------------------------------------------
    // INVENTORY CHECK (SAME DAY)
    // -------------------------------------------------
    let inventory = await RoomInventory.findOne({
      roomId,
      date: invDate,
    }).session(session);

    if (!inventory) {
      inventory = new RoomInventory({
        roomId,
        date: invDate,
        timeBlocks: [],
      });
    }

    let bookedRoomNumbers = inventory.timeBlocks
      .filter((block) =>
        isOverlap(
          startMin,
          endMin,
          timeToMinutes(block.from),
          timeToMinutes(block.to)
        )
      )
      .map((block) => block.roomNumber);

    // -------------------------------------------------
    // INVENTORY CHECK (OVERNIGHT - CROSS MIDNIGHT)
    // -------------------------------------------------
    if (endMin >= 1440) {
      const nextDayDate = new Date(invDate.getTime() + 24 * 60 * 60 * 1000);

      const nextDayInventory = await RoomInventory.findOne({
        roomId,
        date: nextDayDate,
      }).session(session);

      if (nextDayInventory) {
        const overflowEnd = endMin - 1440;

        const nextDayBooked = nextDayInventory.timeBlocks
          .filter((block) =>
            isOverlap(
              0,
              overflowEnd,
              timeToMinutes(block.from),
              timeToMinutes(block.to)
            )
          )
          .map((block) => block.roomNumber);

        bookedRoomNumbers = [
          ...new Set([...bookedRoomNumbers, ...nextDayBooked]),
        ];
      }
    }

    // -------------------------------------------------
    // FIND AVAILABLE ROOM NUMBER
    // -------------------------------------------------
    const availableRoom = room.roomNumbers.find(
      (num) => !bookedRoomNumbers.includes(num)
    );

    if (!availableRoom) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "No rooms available for this time slot",
      });
    }

    // -------------------------------------------------
    // CREATE BOOKING
    // -------------------------------------------------
    const bookingCode = "JS-" + Date.now();

    const booking = await RoomBooking.create(
      [
        {
          bookingCode,
          userId,
          propertyId,
          roomId,
          plan,
          isHourly: plan !== "night",
          mealPlan: mealType,
          status: "Booked",
          paymentStatus: "pending",

          // Guest details
          guestDetails: {
            name: `${firstName} ${lastName || ""}`.trim(),
            phone,
            email,
            gender:
              salutation === "Mr"
                ? "Male"
                : salutation === "Mrs" || salutation === "Ms"
                ? "Female"
                : undefined,
          },

          // Stay details
          stayDetails: {
            checkInDate: invDate,
            checkInTime,
            expectedCheckOutDate: checkoutDate,
            expectedCheckOutTime: endTime,
            roomNumber: availableRoom,
            adults,
            children,
          },

          // Coupon (only if applied)
          ...(appliedCoupon && { coupon: appliedCoupon }),

          priceSummary,
        },
      ],
      { session }
    );

    // -------------------------------------------------
    // INCREMENT OFFER USED COUNT
    // -------------------------------------------------
    if (offerDoc) {
      await Offer.findByIdAndUpdate(
        offerDoc._id,
        { $inc: { usedCount: 1 } },
        { session }
      );
    }

    // -------------------------------------------------
    // UPDATE INVENTORY
    // -------------------------------------------------
    inventory.timeBlocks.push({
      from: checkInTime,
      to: endTime,
      plan,
      bookingId: booking[0]._id,
      roomNumber: availableRoom,
    });

    await inventory.save({ session });

    // -------------------------------------------------
    // COMMIT
    // -------------------------------------------------
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Room booked successfully",
      data: booking[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "Booking failed",
      error: error.message,
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

// ======================================================
// 🟢 CHECKOUT + REWARD ENGINE TRIGGER
// ======================================================
// export const updateBookingStatusAndPayment = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { bookingId } = req.params;
//     const { status, paymentStatus } = req.body;

//     const booking = await RoomBooking.findById(bookingId

//     ).session(session);

//     if (!booking) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: "Booking not found",
//       });
//     }

//     if (status) booking.status = status;
//     if (paymentStatus) booking.paymentStatus = paymentStatus;

//     await booking.save({ session });

//     // 🎯 REWARD ELIGIBILITY CHECK
//     const eligible =
//       booking.status === "CheckOut" &&
//       booking.paymentStatus === "paid" &&
//       booking.rewardProcessed === false &&
//       booking.refund?.status === "none";

//     if (eligible) {
//       await rewardService.processBookingReward(booking, session);

//       booking.rewardProcessed = true;
//       await booking.save({ session });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(200).json({
//       success: true,
//       message: "Booking updated successfully",
//       data: booking,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();

//     return res.status(500).json({
//       success: false,
//       message: "Checkout update failed",
//       error: error.message,
//     });
//   }
// };

export const updateBookingStatusAndPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.params;
    const { status, paymentStatus } = req.body;

    const booking = await RoomBooking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (status) booking.status = status;
    if (paymentStatus) booking.paymentStatus = paymentStatus;

    await booking.save({ session });
    console.log("Booking updated:", booking);

    console.log("STATUS:", booking.status);
    console.log("PAYMENT:", booking.paymentStatus);
    console.log("REWARD PROCESSED:", booking.rewardProcessed);
    console.log("REFUND:", booking.refund);

    const eligible =
      booking.status === "CheckOut" &&
      booking.paymentStatus === "paid" &&
      !booking.rewardProcessed &&
      (!booking.refund || booking.refund.status === "none");

    console.log("ELIGIBLE:", eligible);

    if (eligible) {
      console.log("🔥 Calling Reward Engine");

      await rewardService.processBookingReward(booking, session);

      booking.rewardProcessed = true;
      await booking.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "Checkout update failed",
      error: error.message,
    });
  }
};

// ======================================================
// 🟢 GET BOOKINGS OF SPECIFIC USER
// ======================================================
export const getUserBookings = async (req, res) => {
  try {
    // If using auth middleware
    const userId = req.userId || req.params.userId;
    console.log("UserId", userId);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required",
      });
    }

    const { status } = req.query;

    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    //    const filter = {
    //   userId: userId
    // };

    if (status) {
      filter.status = status;
    }

    const bookings = await RoomBooking.find(filter)
      .populate("propertyId", "basicPropertyDetails.name propertyType")
      .sort({ createdAt: -1 }); // latest first

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching bookings",
      error: error.message,
    });
  }
};
