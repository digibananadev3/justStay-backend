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

const minutesToTime = (min) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: collect every booked room number from an inventory doc across ALL
// plan types — used by every plan's availability check for cross-plan safety.
//
//   timeRange: pass { startMin, endMin } to check only overlapping slots;
//              omit (or pass null) to treat ANY block as a conflict.
// ─────────────────────────────────────────────────────────────────────────────
function getBookedRoomsFromInventory(inventory, timeRange = null) {
  const booked = new Set();
  if (!inventory) return booked;

  // ✅ dateToDateLock
  if (
    inventory.dateToDateLock?.isBooked &&
    inventory.dateToDateLock?.roomNumber
  ) {
    booked.add(inventory.dateToDateLock.roomNumber);
  }

  // ✅ nightBlock
  if (inventory.nightBlock?.isBooked && inventory.nightBlock?.roomNumber) {
    booked.add(inventory.nightBlock.roomNumber);
  }

  // ✅ timeBlocks (with optional overlap check)
  if (inventory.timeBlocks?.length) {
    for (const block of inventory.timeBlocks) {
      if (!block.isBooked || !block.roomNumber) continue;

      if (timeRange) {
        const blockStart = timeToMinutes(block.from);
        const blockEnd = timeToMinutes(block.to);
        // Overlap: not (blockEnd <= newStart || blockStart >= newEnd)
        if (
          !(blockEnd <= timeRange.startMin || blockStart >= timeRange.endMin)
        ) {
          booked.add(block.roomNumber);
        }
      } else {
        booked.add(block.roomNumber); // no range = block entire day
      }
    }
  }

  return booked;
}

// ======================================================
// CREATE ROOM BOOKING
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

      // date-to-date
      checkOutDate,

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

      // Extra
      purposeOfVisit,
      specialRequests,
    } = req.body;


    console.log("req.body:", req.body);

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------
    if (!userId || !propertyId || !roomId || !date || !plan) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (!firstName || !phone) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Guest name and phone are required" });
    }

    if (["3hr", "6hr", "night"].includes(plan) && !checkInTime) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "checkInTime is required for this plan",
      });
    }

    if (plan === "date-to-date" && !checkOutDate) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "checkOutDate is required for date-to-date plan",
      });
    }

    // -------------------------------------------------
    // FETCH ROOM
    // -------------------------------------------------
    const room = await PropertyRoom.findById(roomId).session(session);
    if (!room) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    // -------------------------------------------------
    // PLAN LOGIC
    // -------------------------------------------------
    let stayType;
    let duration;
    let isHourly = false;
    let isOpenStay = false;

    switch (plan) {
      case "3hr":
        stayType = "threeHours";
        duration = 180;
        isHourly = true;
        break;
      case "6hr":
        stayType = "sixHours";
        duration = 360;
        isHourly = true;
        break;
      case "night":
        stayType = "oneNight";
        duration = 720;
        break;
      case "date-to-date":
        stayType = "dateToDate";
        duration = null;
        break;
      case "open-stay":
        stayType = "openStay";
        duration = null;
        isOpenStay = true;
        break;
      default:
        await session.abortTransaction();
        return res
          .status(400)
          .json({ success: false, message: "Invalid plan selected" });
    }

    // -------------------------------------------------
    // PRICING
    // -------------------------------------------------
    if (!room.pricing?.[stayType]?.[mealType]) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Pricing configuration error" });
    }

    const basePrice = room.pricing[stayType][mealType];
    const discountPercent = room.discounts?.[`${stayType}Percent`] || 0;
    const discountAmount = parseFloat(
      ((basePrice * discountPercent) / 100).toFixed(2),
    );
    const finalRoomPrice = basePrice - discountAmount;

    // -------------------------------------------------
    // COUPON / OFFER LOGIC
    // -------------------------------------------------
    let couponDiscount = 0;
    let appliedCoupon = null;
    let offerDoc = null;

    if (couponCode) {
      offerDoc = await Offer.findOne({
        promoCode: couponCode.toUpperCase(),
        isActive: true,
      });

      if (!offerDoc) {
        await session.abortTransaction();
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired promo code" });
      }

      if (offerDoc.usageLimit && offerDoc.usedCount >= offerDoc.usageLimit) {
        await session.abortTransaction();
        return res
          .status(400)
          .json({ success: false, message: "Promo code usage limit reached" });
      }

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

      if (offerDoc.minAmount && finalRoomPrice < offerDoc.minAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Minimum booking amount of ₹${offerDoc.minAmount} required`,
        });
      }

      if (offerDoc.discountType === "percentage") {
        couponDiscount = (finalRoomPrice * offerDoc.discountValue) / 100;
      } else if (offerDoc.discountType === "fixed") {
        couponDiscount = offerDoc.discountValue;
      } else if (offerDoc.discountType === "free_night") {
        couponDiscount = finalRoomPrice;
      }

      couponDiscount = parseFloat(
        Math.min(couponDiscount, finalRoomPrice).toFixed(2),
      );

      appliedCoupon = {
        code: offerDoc.promoCode,
        discountAmount: couponDiscount,
      };
    }

    // -------------------------------------------------
    // FINAL PRICE CALCULATION
    // -------------------------------------------------
    const totalDiscount = parseFloat(
      (discountAmount + couponDiscount).toFixed(2),
    );
    const priceAfterDiscount = finalRoomPrice - couponDiscount;
    const tax = parseFloat((priceAfterDiscount * 0.12).toFixed(2));
    const platformFee = 50;
    const totalAmount = parseFloat(
      (priceAfterDiscount + tax + platformFee).toFixed(2),
    );

    const priceSummary = {
      roomPrice: basePrice,
      foodPrice: 0,
      taxAndServiceFees: plan === "open-stay" ? 0 : tax,
      discount: totalDiscount,
      platformFee: plan === "open-stay" ? 0 : platformFee,
      totalAmount: plan === "open-stay" ? 0 : totalAmount,
    };

    const agreedDailyRate = plan === "open-stay" ? finalRoomPrice : 0;

    // -------------------------------------------------
    // DATE SETUP
    // -------------------------------------------------
    const invDate = new Date(`${date}T00:00:00.000Z`);

    // -------------------------------------------------
    // TIME + SLOT CALCULATION
    // -------------------------------------------------
    let slotEndTime = null;
    let nightCheckOutTime = null;
    let expectedCheckOutDate = null;
    let expectedCheckOutTime = null;
    let checkoutDate = null;

    if (duration !== null && checkInTime) {
      const startMin = timeToMinutes(checkInTime);
      const endMin = startMin + duration;
      const endTime = minutesToTime(endMin);

      checkoutDate =
        endMin >= 1440
          ? new Date(invDate.getTime() + 24 * 60 * 60 * 1000)
          : invDate;

      if (isHourly) {
        slotEndTime = endTime;
      } else if (plan === "night") {
        nightCheckOutTime = endTime;
        expectedCheckOutDate = checkoutDate;
        expectedCheckOutTime = endTime;
      }
    }

    if (plan === "date-to-date") {
      expectedCheckOutDate = new Date(`${checkOutDate}T00:00:00.000Z`);
      checkoutDate = expectedCheckOutDate;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INVENTORY CHECK & ROOM NUMBER ASSIGNMENT
    // ═══════════════════════════════════════════════════════════════════════
    let availableRoom = null;

    // ─────────────────────────────────────────────────────────────────────
    // PLAN: 3hr / 6hr
    // Checks: overlapping timeBlocks + nightBlock + dateToDateLock (via helper)
    //         + open-stays that started ON OR BEFORE this date (✅ $lte fix)
    // ─────────────────────────────────────────────────────────────────────
    if (["3hr", "6hr"].includes(plan)) {
      const startMin = timeToMinutes(checkInTime);
      const endMin = startMin + duration;

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

      // helper now returns dateToDateLock + nightBlock + overlapping timeBlocks
      const bookedRooms = getBookedRoomsFromInventory(inventory, {
        startMin,
        endMin,
      });

      // Cross-midnight overflow: check next day's inventory too
      if (endMin >= 1440) {
        const nextDayDate = new Date(invDate.getTime() + 24 * 60 * 60 * 1000);
        const nextDayInventory = await RoomInventory.findOne({
          roomId,
          date: nextDayDate,
        }).session(session);

        if (nextDayInventory) {
          const overflowEnd = endMin - 1440;
          getBookedRoomsFromInventory(nextDayInventory, {
            startMin: 0,
            endMin: overflowEnd,
          }).forEach((r) => bookedRooms.add(r));
        }
      }

      // ✅ FIX: $lte catches open-stays that started BEFORE this date and are still active
      const openStaysOnDate = await RoomBooking.find({
        roomId,
        plan: "open-stay",
        status: { $in: ["Booked", "CheckIn"] },
        actualCheckOutAt: null,
        "stayDetails.checkInDate": { $lte: invDate }, // was $eq — missed earlier open-stays
      }).session(session);

      for (const b of openStaysOnDate) {
        if (b.stayDetails?.roomNumber)
          bookedRooms.add(b.stayDetails.roomNumber);
      }

      availableRoom = room.roomNumbers.find((num) => !bookedRooms.has(num));

      if (!availableRoom) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "No rooms available for this time slot",
        });
      }

      inventory.timeBlocks.push({
        from: checkInTime,
        to: slotEndTime,
        plan,
        bookingId: null,
        roomNumber: availableRoom,
        isBooked: true,
      });

      await inventory.save({ session });

      // ─────────────────────────────────────────────────────────────────────
      // PLAN: night
      // Checks: nightBlock + dateToDateLock + timeBlocks (via helper)
      //         + open-stays started ON OR BEFORE this date (✅ $lte fix)
      // ─────────────────────────────────────────────────────────────────────
    } else if (plan === "night") {
      let inventory = await RoomInventory.findOne({
        roomId,
        date: invDate,
      }).session(session);

      if (!inventory) {
        inventory = new RoomInventory({ roomId, date: invDate });
      }

      // helper now includes dateToDateLock + timeBlocks (no timeRange = whole day)
      const bookedRooms = getBookedRoomsFromInventory(inventory);

      // ✅ FIX: $lte instead of $eq — catches open-stays started before this date
      const openStaysOnDate = await RoomBooking.find({
        roomId,
        plan: "open-stay",
        status: { $in: ["Booked", "CheckIn"] },
        actualCheckOutAt: null,
        "stayDetails.checkInDate": { $lte: invDate }, // was $eq — missed earlier open-stays
      }).session(session);

      for (const b of openStaysOnDate) {
        if (b.stayDetails?.roomNumber)
          bookedRooms.add(b.stayDetails.roomNumber);
      }

      availableRoom = room.roomNumbers.find((num) => !bookedRooms.has(num));

      if (!availableRoom) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "No rooms available for tonight",
        });
      }

      inventory.nightBlock = {
        bookingId: null,
        roomNumber: availableRoom,
        checkOutTime: nightCheckOutTime,
        isBooked: true,
      };

      await inventory.save({ session });

      // ─────────────────────────────────────────────────────────────────────
      // PLAN: date-to-date
      // Checks: all inventory blocks across every date in range (via helper,
      //         which now includes nightBlock + timeBlocks + dateToDateLock)
      //         + open-stays that started before checkout date and are ongoing
      // ─────────────────────────────────────────────────────────────────────
    } else if (plan === "date-to-date") {
      const start = invDate;
      const end = expectedCheckOutDate;
      const datesInRange = [];

      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        datesInRange.push(new Date(d));
      }

      const existingInventories = await RoomInventory.find({
        roomId,
        date: { $in: datesInRange },
      }).session(session);

      const globallyBookedRooms = new Set();

      // helper now includes nightBlock + timeBlocks + dateToDateLock per day
      for (const inv of existingInventories) {
        getBookedRoomsFromInventory(inv).forEach((r) =>
          globallyBookedRooms.add(r),
        );
      }

      // ✅ Open-stays: started before our checkout and still ongoing (no end)
      const overlappingOpenStays = await RoomBooking.find({
        roomId,
        plan: "open-stay",
        status: { $in: ["Booked", "CheckIn"] },
        actualCheckOutAt: null,
        "stayDetails.checkInDate": { $lt: end }, // open-stay started before our end
      }).session(session);

      for (const b of overlappingOpenStays) {
        if (b.stayDetails?.roomNumber)
          globallyBookedRooms.add(b.stayDetails.roomNumber);
      }

      availableRoom = room.roomNumbers.find(
        (num) => !globallyBookedRooms.has(num),
      );

      if (!availableRoom) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "No rooms available for selected dates",
        });
      }

      for (const d of datesInRange) {
        await RoomInventory.findOneAndUpdate(
          { roomId, date: d },
          {
            $set: {
              "dateToDateLock.bookingId": null,
              "dateToDateLock.roomNumber": availableRoom,
              "dateToDateLock.isBooked": true,
            },
          },
          { upsert: true, session },
        );
      }

      // ─────────────────────────────────────────────────────────────────────
      // PLAN: open-stay
      // Checks: other active open-stays + today's inventory (all block types
      //         via helper) + ✅ future dateToDateLock entries that would
      //         overlap (since open-stay has no end date)
      // ─────────────────────────────────────────────────────────────────────
    } else if (plan === "open-stay") {
      const activeOpenStays = await RoomBooking.find({
        roomId,
        plan: "open-stay",
        status: { $in: ["Booked", "CheckIn"] },
        actualCheckOutAt: null,
      }).session(session);

      const openStayOccupiedRooms = new Set(
        activeOpenStays.map((b) => b.stayDetails?.roomNumber).filter(Boolean),
      );

      // Today's inventory — helper includes dateToDateLock + nightBlock + timeBlocks
      const inventory = await RoomInventory.findOne({
        roomId,
        date: invDate,
      }).session(session);

      const inventoryBookedRooms = getBookedRoomsFromInventory(inventory);

      // ✅ FIX: also block rooms locked by any future dateToDateLock starting
      // on or after today — open-stay has no end, so it conflicts with all of them
      // ✅ FIX: get ALL future inventories
      const futureInventories = await RoomInventory.find({
        roomId,
        date: { $gte: invDate },
      }).session(session);

      // Collect ALL booked rooms from ALL block types
      for (const inv of futureInventories) {
        getBookedRoomsFromInventory(inv).forEach((r) =>
          inventoryBookedRooms.add(r),
        );
      }

      const allBookedRooms = new Set([
        ...openStayOccupiedRooms,
        ...inventoryBookedRooms,
      ]);

      availableRoom = room.roomNumbers.find((num) => !allBookedRooms.has(num));

      if (!availableRoom) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "No rooms available for open stay on this date",
        });
      }
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
          isHourly,
          isOpenStay,
          agreedDailyRate,
          mealPlan: mealType,
          status: "Booked",
          paymentStatus: "pending",

          guestDetails: {
            name: `${firstName} ${lastName || ""}`.trim(),
            phone,
            email,
            gender:
              salutation === "Mr"
                ? "Male"
                : ["Mrs", "Ms"].includes(salutation)
                  ? "Female"
                  : undefined,
          },

          stayDetails: {
            checkInDate: invDate,
            checkInTime: checkInTime || null,
            slotEndTime,
            nightCheckOutTime,
            expectedCheckOutDate,
            expectedCheckOutTime,
            roomNumber: availableRoom,
            roomType: room.type,
            adults,
            children,
            purposeOfVisit: purposeOfVisit || null,
          },

          ...(appliedCoupon && { coupon: appliedCoupon }),

          priceSummary,
          specialRequests: specialRequests || "",
        },
      ],
      { session },
    );

    // -------------------------------------------------
    // UPDATE BOOKING ID IN INVENTORY BLOCKS
    // -------------------------------------------------
    const bookingId = booking[0]._id;

    if (["3hr", "6hr"].includes(plan)) {
      await RoomInventory.updateOne(
        { roomId, date: invDate, "timeBlocks.roomNumber": availableRoom },
        { $set: { "timeBlocks.$.bookingId": bookingId } },
        { session },
      );
    } else if (plan === "night") {
      await RoomInventory.updateOne(
        { roomId, date: invDate },
        { $set: { "nightBlock.bookingId": bookingId } },
        { session },
      );
    } else if (plan === "date-to-date") {
      const start = invDate;
      const end = expectedCheckOutDate;
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        await RoomInventory.updateOne(
          { roomId, date: new Date(d) },
          { $set: { "dateToDateLock.bookingId": bookingId } },
          { session },
        );
      }
    }

    // -------------------------------------------------
    // INCREMENT OFFER USED COUNT
    // -------------------------------------------------
    if (offerDoc) {
      await Offer.findByIdAndUpdate(
        offerDoc._id,
        { $inc: { usedCount: 1 } },
        { session },
      );
    }

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
// UPDATE ROOM BOOKING
// ======================================================
export const updateRoomBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedBooking = await RoomBooking.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedBooking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    res.status(200).json({
      success: true,
      message: "Room booking updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ======================================================
// GET BOOKING BY ID
// ======================================================
export const getRoomBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await RoomBooking.findById(id)
      .populate("userId", "firstName lastName email phone")
      .populate("propertyId", "basicPropertyDetails.name propertyType");

    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    res.status(200).json({
      success: true,
      message: "Booking details fetched successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ======================================================
// GET ALL BOOKINGS
// ======================================================
export const getAllRoomBookings = async (req, res) => {
  try {
    const { userId, propertyId, status } = req.query;
    const filter = {};

    if (userId && mongoose.Types.ObjectId.isValid(userId))
      filter.userId = new mongoose.Types.ObjectId(userId);

    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId))
      filter.propertyId = new mongoose.Types.ObjectId(propertyId);

    if (status) filter.status = status;

    const bookings = await RoomBooking.find(filter)
      .populate("userId", "firstName lastName email phone")
      .populate("propertyId", "basicPropertyDetails.name propertyType");

    res
      .status(200)
      .json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};


// ======================================================
// GET BOOKINGS OF A SPECIFIC ROOM (can be enhanced with date filtering to show only overlapping bookings)
// ======================================================
export const getAllBookedSlotsForRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roomId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
        
    const bookings = await RoomBooking.find({ roomId })
      .populate("userId", "firstName lastName email phone")
      .populate("propertyId", "basicPropertyDetails.name propertyType")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ success: true, count: bookings.length, data: bookings });
  }
    catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ======================================================
// DELETE BOOKING
// ======================================================
export const deleteRoomBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await RoomBooking.findByIdAndDelete(id);

    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    res
      .status(200)
      .json({ success: true, message: "Room booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ======================================================
// UPDATE BOOKING STATUS + PAYMENT (CHECKOUT)
// ======================================================
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
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (status) booking.status = status;
    if (paymentStatus) booking.paymentStatus = paymentStatus;

    if (status === "CheckIn" && !booking.actualCheckInAt) {
      booking.actualCheckInAt = new Date();
    }

    if (status === "CheckOut" && !booking.actualCheckOutAt) {
      booking.actualCheckOutAt = new Date();

      if (booking.isOpenStay && booking.actualCheckInAt) {
        const nights = Math.max(
          1,
          Math.ceil(
            (booking.actualCheckOutAt - booking.actualCheckInAt) /
              (1000 * 60 * 60 * 24),
          ),
        );
        const roomPrice = nights * booking.agreedDailyRate;
        const tax = parseFloat((roomPrice * 0.12).toFixed(2));
        const platformFee = 50;

        booking.priceSummary.roomPrice = roomPrice;
        booking.priceSummary.taxAndServiceFees = tax;
        booking.priceSummary.platformFee = platformFee;
        booking.priceSummary.totalAmount = parseFloat(
          (
            roomPrice +
            tax +
            platformFee -
            booking.priceSummary.discount
          ).toFixed(2),
        );
      }
    }

    await booking.save({ session });

    const eligible =
      booking.status === "CheckOut" &&
      booking.paymentStatus === "paid" &&
      !booking.rewardProcessed &&
      (!booking.refund || booking.refund.status === "none");

    if (eligible) {
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
// GET BOOKINGS OF SPECIFIC USER
// ======================================================
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.userId || req.params.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res
        .status(400)
        .json({ success: false, message: "Valid userId is required" });

    const { status } = req.query;
    const filter = { userId: new mongoose.Types.ObjectId(userId) };
    if (status) filter.status = status;

    const bookings = await RoomBooking.find(filter)
      .populate("propertyId", "basicPropertyDetails.name propertyType")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};




// ======================================================
// GUEST CHECK-IN FORM (Manual Check-In with Full Details)
// ======================================================
export const guestCheckInForm = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.params;

    const {
      // Guest Details
      name,
      fatherOrSpouseName,
      gender,
      age,
      address,
      pincode,
      city,
      state,
      phone,
      email,

      // Identification Proof
      idType,
      idNumber,
      documentUrl,

      // Stay Details
      roomNumber,
      roomType,
      adults,
      children,
      checkInDate,
      checkInTime,
      expectedCheckOutDate,
      expectedCheckOutTime,
      purposeOfVisit,

      // Co-Guest Details (array)
      // [{ name, idType, number, idUrl }]
      coGuestDetails,

      // Extra
      specialRequests,
      adminNotes,
    } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------
    if (!bookingId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    if (!name || !phone) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Guest name and phone number are required",
      });
    }

    // -------------------------------------------------
    // FETCH BOOKING
    // -------------------------------------------------
    const booking = await RoomBooking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // -------------------------------------------------
    // GUARD: only allow check-in from "Booked" status
    // -------------------------------------------------
    if (booking.status !== "Booked") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Cannot check in a booking with status "${booking.status}"`,
      });
    }

    // -------------------------------------------------
    // UPDATE GUEST DETAILS
    // -------------------------------------------------
    booking.guestDetails = {
      name,
      fatherOrSpouseName: fatherOrSpouseName || booking.guestDetails?.fatherOrSpouseName,
      gender: gender || booking.guestDetails?.gender,
      age: age !== undefined ? Number(age) : booking.guestDetails?.age,
      address: address || booking.guestDetails?.address,
      pincode: pincode || booking.guestDetails?.pincode,
      city: city || booking.guestDetails?.city,
      state: state || booking.guestDetails?.state,
      phone,
      email: email || booking.guestDetails?.email,
    };

    // -------------------------------------------------
    // UPDATE IDENTIFICATION PROOF
    // -------------------------------------------------
    if (idType || idNumber || documentUrl) {
      booking.identificationProof = {
        type: idType || booking.identificationProof?.type,
        number: idNumber || booking.identificationProof?.number,
        documentUrl: documentUrl || booking.identificationProof?.documentUrl,
      };
    }

    // -------------------------------------------------
    // UPDATE STAY DETAILS
    // -------------------------------------------------
    if(booking)
    if (roomNumber && booking.stayDetails.roomNumber == roomNumber) booking.stayDetails.roomNumber = roomNumber;
    if (roomType && booking.stayDetails.roomType == roomNumber) booking.stayDetails.roomType = roomType;
    if (adults !== undefined) booking.stayDetails.adults = Number(adults);
    if (children !== undefined) booking.stayDetails.children = Number(children);
    if (purposeOfVisit) booking.stayDetails.purposeOfVisit = purposeOfVisit;

    if (checkInDate) {
      booking.stayDetails.checkInDate = new Date(`${checkInDate}T00:00:00.000Z`);
    }
    if (checkInTime) booking.stayDetails.checkInTime = checkInTime;

    if (expectedCheckOutDate) {
      booking.stayDetails.expectedCheckOutDate = new Date(
        `${expectedCheckOutDate}T00:00:00.000Z`
      );
    }
    if (expectedCheckOutTime) {
      booking.stayDetails.expectedCheckOutTime = expectedCheckOutTime;
    }

    // -------------------------------------------------
    // UPDATE CO-GUEST DETAILS
    // -------------------------------------------------
    if (Array.isArray(coGuestDetails) && coGuestDetails.length > 0) {
      booking.coGuestDetails = coGuestDetails.map((g) => ({
        name: g.name || "",
        idType: g.idType || "",
        number: g.number || "",
        idUrl: g.idUrl || "",
      }));
    }

    // -------------------------------------------------
    // OPTIONAL FIELDS
    // -------------------------------------------------
    if (specialRequests !== undefined) booking.specialRequests = specialRequests;
    if (adminNotes !== undefined) booking.adminNotes = adminNotes;

    // -------------------------------------------------
    // MARK AS CHECK-IN
    // -------------------------------------------------
    booking.status = "CheckIn";
    booking.actualCheckInAt = new Date();

    // -------------------------------------------------
    // SAVE
    // -------------------------------------------------
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Guest checked in successfully",
      data: booking,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log("Error during guest check-in:", error);
    return res.status(500).json({
      success: false,
      message: "Check-in failed",
      error: error.message,
    });
  }
};