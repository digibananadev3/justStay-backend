import PropertyInfo from "../models/property.model.js";
import PropertyRoom from "../models/propertyRoom.model.js";
import RoomInventory from "../models/roomInventory.model.js";
import RoomBooking from "../models/roomBooking.model.js";
import mongoose from "mongoose";
import { Parser } from "@json2csv/plainjs";
import Review from "../models/review.model.js";

// =============================================================================
// AVAILABILITY HELPERS
// =============================================================================
const _timeToMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Collects every booked room number from a single inventory doc across ALL
 * block types (dateToDateLock, nightBlock, timeBlocks).
 *
//  * @param {Object|null} inventory  - Lean inventory document
//  * @param {{ startMin: number, endMin: number }|null} timeRange
//  *   Pass a timeRange to check only overlapping timeBlocks (for 3hr/6hr).
//  *   Omit (or pass null) to treat any block as a conflict (night, date-to-date, open-stay).
//  * @returns {Set<string>} Set of booked room numbers
//  */
function _bookedFromInventory(inventory, timeRange = null) {
  const booked = new Set();
  if (!inventory) return booked;

  // dateToDateLock
  if (
    inventory.dateToDateLock?.isBooked &&
    inventory.dateToDateLock?.roomNumber
  )
    booked.add(inventory.dateToDateLock.roomNumber);

  // nightBlock
  if (inventory.nightBlock?.isBooked && inventory.nightBlock?.roomNumber)
    booked.add(inventory.nightBlock.roomNumber);

  // timeBlocks — with optional overlap check for hourly plans
  for (const block of inventory.timeBlocks ?? []) {
    if (!block.isBooked || !block.roomNumber) continue;

    if (timeRange) {
      const bs = _timeToMin(block.from);
      const be = _timeToMin(block.to);
      // overlaps if NOT (blockEnd <= newStart OR blockStart >= newEnd)
      if (!(be <= timeRange.startMin || bs >= timeRange.endMin))
        booked.add(block.roomNumber);
    } else {
      booked.add(block.roomNumber);
    }
  }

  return booked;
}

// /**
//  * Returns true if the property has at least one free room for the requested
//  * plan + date combination. Mirrors the exact availability logic in
//  * createRoomBooking so filter results always match booking reality.
//  *
//  * Supports all 5 plan types:
//  *   "3hr" | "6hr" | "night" | "date-to-date" | "open-stay"
//  *
//  * @param {mongoose.Types.ObjectId|string} propertyId
//  * @param {{ plan: string, checkInDate: Date, checkOutDate?: Date, checkInTime?: string }} opts
//  * @returns {Promise<boolean>}
//  */
async function checkAvailabilityForProperty(
  propertyId,
  { plan, checkInDate, checkOutDate, checkInTime },
) {
  const durationMap = { "3hr": 180, "6hr": 360, night: 720 };
  const duration = durationMap[plan] ?? null;

  // All room types belonging to this property
  const rooms = await PropertyRoom.find({ propertyId }).lean();
  if (!rooms.length) return false;

  const invDate = checkInDate; // already a JS Date (UTC midnight)

  for (const room of rooms) {
    const roomId = room._id;
    const allNums = room.roomNumbers;
    if (!allNums.length) continue;

    const bookedRooms = new Set();

    // ── 3hr / 6hr ────────────────────────────────────────────────────────────
    if (["3hr", "6hr"].includes(plan)) {
      const startMin = _timeToMin(checkInTime);
      const endMin = startMin + duration;

      const inv = await RoomInventory.findOne({ roomId, date: invDate }).lean();
      _bookedFromInventory(inv, { startMin, endMin }).forEach((r) =>
        bookedRooms.add(r),
      );

      // Cross-midnight overflow: check next day's inventory too
      if (endMin >= 1440) {
        const nextDay = new Date(invDate.getTime() + 86_400_000);
        const nextInv = await RoomInventory.findOne({
          roomId,
          date: nextDay,
        }).lean();
        _bookedFromInventory(nextInv, {
          startMin: 0,
          endMin: endMin - 1440,
        }).forEach((r) => bookedRooms.add(r));
      }

      // Active open-stays that started on or before this date ($lte fix)
      const openStays = await RoomBooking.find({
        roomId,
        plan: "open-stay",
        status: { $in: ["Booked", "CheckIn"] },
        actualCheckOutAt: null,
        "stayDetails.checkInDate": { $lte: invDate },
      }).lean();
      openStays.forEach(
        (b) =>
          b.stayDetails?.roomNumber &&
          bookedRooms.add(b.stayDetails.roomNumber),
      );

      // ── night ─────────────────────────────────────────────────────────────────
    } else if (plan === "night") {
      const inv = await RoomInventory.findOne({ roomId, date: invDate }).lean();
      _bookedFromInventory(inv).forEach((r) => bookedRooms.add(r));

      const openStays = await RoomBooking.find({
        roomId,
        plan: "open-stay",
        status: { $in: ["Booked", "CheckIn"] },
        actualCheckOutAt: null,
        "stayDetails.checkInDate": { $lte: invDate },
      }).lean();
      openStays.forEach(
        (b) =>
          b.stayDetails?.roomNumber &&
          bookedRooms.add(b.stayDetails.roomNumber),
      );

      // ── date-to-date ──────────────────────────────────────────────────────────
    } else if (plan === "date-to-date") {
      const end = checkOutDate;
      const datesInRange = [];
      for (let d = new Date(invDate); d < end; d.setDate(d.getDate() + 1))
        datesInRange.push(new Date(d));

      const inventories = await RoomInventory.find({
        roomId,
        date: { $in: datesInRange },
      }).lean();

      for (const inv of inventories)
        _bookedFromInventory(inv).forEach((r) => bookedRooms.add(r));

      // Open-stays that started before our checkout date and are still active
      const openStays = await RoomBooking.find({
        roomId,
        plan: "open-stay",
        status: { $in: ["Booked", "CheckIn"] },
        actualCheckOutAt: null,
        "stayDetails.checkInDate": { $lt: end },
      }).lean();
      openStays.forEach(
        (b) =>
          b.stayDetails?.roomNumber &&
          bookedRooms.add(b.stayDetails.roomNumber),
      );

      // ── open-stay ─────────────────────────────────────────────────────────────
    } else if (plan === "open-stay") {
      // Other active open-stays in the same room
      const activeOpenStays = await RoomBooking.find({
        roomId,
        plan: "open-stay",
        status: { $in: ["Booked", "CheckIn"] },
        actualCheckOutAt: null,
      }).lean();
      activeOpenStays.forEach(
        (b) =>
          b.stayDetails?.roomNumber &&
          bookedRooms.add(b.stayDetails.roomNumber),
      );

      // Today's inventory (all block types)
      const inv = await RoomInventory.findOne({ roomId, date: invDate }).lean();
      _bookedFromInventory(inv).forEach((r) => bookedRooms.add(r));

      // ALL future inventory — open-stay has no end date so every future lock
      // for this room conflicts with it
      const futureInventories = await RoomInventory.find({
        roomId,
        date: { $gte: invDate },
      }).lean();
      for (const fi of futureInventories)
        _bookedFromInventory(fi).forEach((r) => bookedRooms.add(r));
    }

    // ── At least one room number free in this room type → property is available
    const hasFreeRoom = allNums.some((num) => !bookedRooms.has(num));
    if (hasFreeRoom) return true; // short-circuit — no need to check other room types
  }

  return false; // every room number across every room type is booked
}

// -----------------------------
// Update Property Rating (After Review Created/Updated/Deleted)
// -----------------------------
export const updatePropertyRating = async (propertyId) => {
  const result = await Review.aggregate([
    {
      $match: {
        propertyId: new mongoose.Types.ObjectId(propertyId),
        isPublished: true,
      },
    },
    {
      $group: {
        _id: "$propertyId",
        avgRating: { $avg: "$rating" },
        guestTotalReviews: { $sum: 1 },
      },
    },
  ]);

  let avgRating = 0;
  let guestTotalReviews = 0;

  if (result.length > 0) {
    avgRating = result[0].avgRating;
    guestTotalReviews = result[0].guestTotalReviews;
  }

  await PropertyInfo.findByIdAndUpdate(propertyId, {
    guestAverageRating: Number(avgRating.toFixed(1)),
    guestTotalReviews,
  });
};

// -----------------------------
// Update Property Pricing (Hotelier)
// -----------------------------
export const updatePropertyPricing = async (propertyId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return;
    }

    const result = await PropertyRoom.aggregate([
      {
        $match: {
          propertyId: new mongoose.Types.ObjectId(propertyId),
        },
      },

      {
        $project: {
          oneNightPrices: [
            "$pricing.oneNight.roomOnly",
            "$pricing.oneNight.withBreakfast",
          ],
          threeHourPrices: [
            "$pricing.threeHours.roomOnly",
            "$pricing.threeHours.withBreakfast",
          ],
          sixHourPrices: [
            "$pricing.sixHours.roomOnly",
            "$pricing.sixHours.withBreakfast",
          ],
          dateToDatePrices: [
            "$pricing.dateToDate.roomOnly",
            "$pricing.dateToDate.withBreakfast",
          ],
          openStayPrices: [
            "$pricing.openStay.roomOnly",
            "$pricing.openStay.withBreakfast",
          ],
        },
      },

      {
        $project: {
          allOneNight: {
            $filter: {
              input: { $setUnion: ["$oneNightPrices"] },
              as: "p",
              cond: { $ne: ["$$p", null] },
            },
          },
          allThreeHours: {
            $filter: {
              input: { $setUnion: ["$threeHourPrices"] },
              as: "p",
              cond: { $ne: ["$$p", null] },
            },
          },
          allSixHours: {
            $filter: {
              input: { $setUnion: ["$sixHourPrices"] },
              as: "p",
              cond: { $ne: ["$$p", null] },
            },
          },
          allDateToDate: {
            $filter: {
              input: { $setUnion: ["$dateToDatePrices"] },
              as: "p",
              cond: { $ne: ["$$p", null] },
            },
          },
          allOpenStay: {
            $filter: {
              input: { $setUnion: ["$openStayPrices"] },
              as: "p",
              cond: { $ne: ["$$p", null] },
            },
          },
        },
      },

      {
        $group: {
          _id: null,

          minOneNight: { $min: { $min: "$allOneNight" } },
          maxOneNight: { $max: { $max: "$allOneNight" } },

          minThreeHours: { $min: { $min: "$allThreeHours" } },
          maxThreeHours: { $max: { $max: "$allThreeHours" } },

          minSixHours: { $min: { $min: "$allSixHours" } },
          maxSixHours: { $max: { $max: "$allSixHours" } },

          minDateToDate: { $min: { $min: "$allDateToDate" } }, // ✅
          maxDateToDate: { $max: { $max: "$allDateToDate" } }, // ✅
          minOpenStay: { $min: { $min: "$allOpenStay" } }, // ✅
          maxOpenStay: { $max: { $max: "$allOpenStay" } }, // ✅
        },
      },
    ]);

    const pricing = result[0] || {};

    await PropertyInfo.findByIdAndUpdate(propertyId, {
      pricing: {
        minOneNightPrice: pricing.minOneNight || 0,
        maxOneNightPrice: pricing.maxOneNight || 0,
        minThreeHoursPrice: pricing.minThreeHours || 0,
        maxThreeHoursPrice: pricing.maxThreeHours || 0,
        minSixHoursPrice: pricing.minSixHours || 0,
        maxSixHoursPrice: pricing.maxSixHours || 0,

        minDateToDatePrice: pricing.minDateToDate || 0,
        maxDateToDatePrice: pricing.maxDateToDate || 0,
        minOpenStayPrice: pricing.minOpenStay || 0,
        maxOpenStayPrice: pricing.maxOpenStay || 0,
      },
    });
  } catch (error) {
    console.error(
      "Error updating property pricing for propertyId:",
      propertyId,
      "Error:",
      error,
    );
  }
};

// -----------------------------
// Create Property (Hotelier)
// -----------------------------
export const createOrUpdateProperty = async (req, res) => {
  try {
    const userId = req.body.userId; // logged-in user (Hotelier)
    const propertyId = req.body.propertyId; // optional

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    let property;

    if (propertyId) {
      property = await PropertyInfo.findById(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      Object.assign(property, req.body); // merge updates
      await property.save();

      return res.status(200).json({
        message: "Property updated successfully",
        property,
      });
    } else {
      // Create new property
      property = await PropertyInfo.create(req.body || {});

      return res.status(201).json({
        message: "Property created successfully",
        property,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Get All Properties
// -----------------------------
export const getAllProperties = async (req, res) => {
  try {
    const properties = await PropertyInfo.find({ isDeleted: false }).populate(
      "userId",
      "firstName lastName email phone role",
    );
    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Get Property by ID
// -----------------------------
export const getPropertyById = async (req, res) => {
  try {
    const property = await PropertyInfo.findOne({
      _id: req.params.id,
      isDeleted: false,
    }).populate("userId", "firstName lastName email phone role");

    if (!property)
      return res.status(404).json({ message: "Property not found" });

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Update Property (Hotelier/Admin)
// -----------------------------
export const updateProperty = async (req, res) => {
  try {
    const property = await PropertyInfo.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!property)
      return res.status(404).json({ message: "Property not found" });

    // Optional: Only allow owner or admin to update
    if (
      property.userId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this property" });
    }

    Object.assign(property, req.body); // merge updates
    await property.save();

    res
      .status(200)
      .json({ message: "Property updated successfully", property });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Delete Property (Hotelier/Admin)
// -----------------------------
export const deleteProperty = async (req, res) => {
  try {
    const property = await PropertyInfo.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!property)
      return res.status(404).json({ message: "Property not found" });

    // Optional: Only allow owner or admin to delete
    if (
      property.userId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this property" });
    }

    // await property.remove();
    property.isDeleted = true;
    property.deletedAt = new Date();
    await property.save();

    res.status(200).json({ message: "Property soft deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// =============================================================================
// Sort And Filter Properties (Guest)
// =============================================================================
// Query params (all optional):
//
//   Standard filters  : lat, lng, minPrice, maxPrice, starRating, guestRating,
//                        amenities, stayType, city, state, search, sortBy
//
//   Availability filter (all five plan types supported):
//     plan          "night" | "3hr" | "6hr" | "date-to-date" | "open-stay"
//     checkInDate   "YYYY-MM-DD"  (required when plan is provided)
//     checkOutDate  "YYYY-MM-DD"  (required when plan === "date-to-date")
//     checkInTime   "HH:MM"       (required when plan === "3hr" or "6hr")
//
// Behaviour when plan + checkInDate are supplied:
//   • All five plan types are supported.
//   • A property is shown when at least ONE room number across ANY of its
//     room types is free for the requested stay (partial availability is fine).
//   • The availability check mirrors createRoomBooking exactly — same open-stay
//     $lte fix, same cross-midnight overflow, same cross-plan conflict detection.
// =============================================================================
export const sortAndFilterProperties = async (req, res) => {
  try {
    const {
      lat,
      lng,
      minPrice,
      maxPrice,
      starRating,
      guestRating,
      amenities,
      stayType,
      sortBy,
      city,
      state,
      search,
      // ── availability params ──────────────────────────────────────────────
      plan, // "night" | "3hr" | "6hr" | "date-to-date" | "open-stay"
      checkInDate, // "YYYY-MM-DD"
      checkOutDate, // "YYYY-MM-DD" — required for date-to-date
      checkInTime, // "HH:MM"      — required for 3hr / 6hr
    } = req.query;

    // ── Validate availability params ────────────────────────────────────────
    const VALID_PLANS = ["night", "3hr", "6hr", "date-to-date", "open-stay"];

    if (plan) {
      if (!VALID_PLANS.includes(plan)) {
        return res.status(400).json({
          success: false,
          message: `Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}`,
        });
      }
      if (!checkInDate) {
        return res.status(400).json({
          success: false,
          message:
            "checkInDate (YYYY-MM-DD) is required when plan is specified",
        });
      }
      if (plan === "date-to-date" && !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: "checkOutDate is required for date-to-date plan",
        });
      }
      if (["3hr", "6hr"].includes(plan) && !checkInTime) {
        return res.status(400).json({
          success: false,
          message: "checkInTime (HH:MM) is required for 3hr / 6hr plan",
        });
      }
    }

    // Parse dates once (reused in availability check below)
    const parsedCheckInDate = checkInDate
      ? new Date(`${checkInDate}T00:00:00.000Z`)
      : null;
    const parsedCheckOutDate = checkOutDate
      ? new Date(`${checkOutDate}T00:00:00.000Z`)
      : null;

    // ── Build Mongo match query (unchanged from original) ───────────────────
    const matchQuery = {
      isDeleted: false,
      listingStatus: { $in: ["approved", "pending"] },
    };

    // Fixed escapeRegex — original was missing `return`
    const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (search && search.trim()) {
      const safeSearch = escapeRegex(search.trim());
      const orConditions = [
        { "basicPropertyDetails.name": { $regex: safeSearch, $options: "i" } },
        { "location.state": { $regex: safeSearch, $options: "i" } },
        { "location.city": { $regex: safeSearch, $options: "i" } },
        { "location.area": { $regex: safeSearch, $options: "i" } },
        { "location.landmarks": { $regex: safeSearch, $options: "i" } },
        { "contactDetails.email": { $regex: safeSearch, $options: "i" } },
      ];

      if (mongoose.Types.ObjectId.isValid(search))
        orConditions.push({ _id: new mongoose.Types.ObjectId(search) });

      matchQuery.$and = [...(matchQuery.$and || []), { $or: orConditions }];
    }

    if (city) matchQuery["location.city"] = new RegExp(city, "i");
    if (state) matchQuery["location.state"] = new RegExp(state, "i");

    if (stayType) matchQuery.stayType = { $in: stayType.split(",") };

    if (amenities) matchQuery.propertyAmenities = { $in: amenities.split(",") };

    if (minPrice || maxPrice) {
      matchQuery["pricing.minOneNightPrice"] = {
        $gte: Number(minPrice || 0),
        $lte: Number(maxPrice || 9_999_999),
      };
    }

    if (starRating) matchQuery.hotelRating = { $gte: Number(starRating) };
    if (guestRating)
      matchQuery.guestAverageRating = { $gte: Number(guestRating) };

    // ── Build aggregation pipeline (unchanged from original) ────────────────
    let pipeline = [];

    if (lat && lng) {
      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: "distance",
          spherical: true,
          query: matchQuery,
        },
      });
    } else {
      pipeline.push({ $match: matchQuery });
    }

    if (sortBy === "mostPopular") {
      pipeline.push({
        $lookup: {
          from: "roombookings",
          localField: "_id",
          foreignField: "propertyId",
          as: "bookings",
        },
      });
      pipeline.push({
        $addFields: { bookingCount: { $size: "$bookings" } },
      });
    }

    let sortStage = {};
    switch (sortBy) {
      case "priceLow":
        sortStage = { "pricing.minOneNightPrice": 1 };
        break;
      case "priceHigh":
        sortStage = { "pricing.minOneNightPrice": -1 };
        break;
      case "guestRatingLow":
        sortStage = { guestAverageRating: 1 };
        break;
      case "guestRatingHigh":
        sortStage = { guestAverageRating: -1 };
        break;
      case "starRatingLow":
        sortStage = { hotelRating: 1 };
        break;
      case "starRatingHigh":
        sortStage = { hotelRating: -1 };
        break;
      case "distanceLow":
        sortStage = lat && lng ? { distance: 1 } : { guestAverageRating: -1 };
        break;
      case "distanceHigh":
        sortStage = lat && lng ? { distance: -1 } : { guestAverageRating: -1 };
        break;
      case "mostPopular":
        sortStage = { bookingCount: -1 };
        break;
      case "bestValue":
        sortStage = { "pricing.minOneNightPrice": 1, guestAverageRating: -1 };
        break;
      default:
        sortStage = { guestAverageRating: -1 };
    }

    pipeline.push({ $sort: sortStage });

    let properties = await PropertyInfo.aggregate(pipeline);

    // ── Availability filter (post-aggregation) ───────────────────────────────
    // Runs only when plan + checkInDate are provided.
    // Uses Promise.all so all property checks run concurrently.
    // A property passes if at least ONE room number is free (partial availability).
    if (plan && parsedCheckInDate) {
      const availabilityFlags = await Promise.all(
        properties.map((p) =>
          checkAvailabilityForProperty(p._id, {
            plan,
            checkInDate: parsedCheckInDate,
            checkOutDate: parsedCheckOutDate, // null for non date-to-date plans
            checkInTime: checkInTime || null,
          }),
        ),
      );

      properties = properties.filter((_, i) => availabilityFlags[i]);
    }

    res.status(200).json({
      success: true,
      total: properties.length,
      data: properties,
    });
  } catch (error) {
    console.error("Filter Error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
};

// -----------------------------
// Top Picks For You
// -----------------------------
export const getTopPicksForUser = async (req, res) => {
  try {
    const { longitude, latitude } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        status: "error",
        message: "Longitude and latitude required",
      });
    }

    const nearbyProperties = await PropertyInfo.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          distanceField: "distance",
          maxDistance: 20000, // 20 KM
          spherical: true,
        },
      },
      {
        $match: {
          isDeleted: false,
          // listingStatus: "approved",
          // status: "Accepted",
        },
      },
      {
        $sort: {
          distance: 1,
          guestAverageRating: -1,
        },
      },
      { $limit: 10 },
    ]);

    res.json({
      status: "success",
      nearbyCount: nearbyProperties.length,
      nearbyProperties,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

// -----------------------------
// Set Property Coordinates (Hotelier/Admin)
// -----------------------------
export const setPropertyCoordinates = async (req, res) => {
  try {
    const { propertyId, longitude, latitude } = req.body;

    if (!propertyId || !longitude || !latitude) {
      return res.status(400).json({
        status: "error",
        message: "propertyId, longitude and latitude are required",
      });
    }

    const property = await PropertyInfo.findByIdAndUpdate(
      propertyId,
      {
        "location.coordinates": {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
      },
      { new: true },
    );

    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    res.json({
      status: "success",
      message: "Coordinates updated successfully",
      data: property,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

// -----------------------------
// Get Similar Properties
// -----------------------------
// export const getSimilarProperties = async (req, res) => {
//   try {
//     const { propertyId } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(propertyId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid propertyId",
//       });
//     }

//     // 1. Get current property
//     const currentProperty = await PropertyInfo.findById(propertyId);

//     if (!currentProperty || currentProperty.isDeleted) {
//       return res.status(404).json({
//         success: false,
//         message: "Property not found",
//       });
//     }

//     const city = currentProperty.location.city;
//     const propertyType = currentProperty.propertyType;
//     const basePrice = currentProperty.pricing.minOneNightPrice || 0;
//     const rating = currentProperty.guestAverageRating || 0;

//     // 2. Build similarity query
//     const similarProperties = await PropertyInfo.find({
//       _id: { $ne: propertyId }, // exclude current property
//       // isDeleted: false,
//       // listingStatus: "approved",

//       "location.city": new RegExp(city, "i"), // same city
//       propertyType: propertyType, // same property type

//       "pricing.minOneNightPrice": {
//         $gte: basePrice - 2000,
//         $lte: basePrice + 2000,
//       },

//       guestAverageRating: {
//         $gte: rating - 1, // similar rating range
//       },
//     })
//       .sort({ guestAverageRating: -1 })
//       .limit(6);

//     res.status(200).json({
//       success: true,
//       total: similarProperties.length,
//       data: similarProperties,
//     });
//   } catch (error) {
//     console.error("Similar property error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch similar properties",
//     });
//   }
// };

// -----------------------------
// Get Similar Properties (Smart Version)
// -----------------------------
export const getSimilarProperties = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid propertyId",
      });
    }

    const currentProperty = await PropertyInfo.findById(propertyId);

    if (!currentProperty || currentProperty.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const city = currentProperty.location.city;
    const propertyType = currentProperty.propertyType;
    const basePrice = currentProperty.pricing.minOneNightPrice || 0;

    let similarProperties = [];

    // Strict match
    similarProperties = await PropertyInfo.find({
      _id: { $ne: propertyId },
      // isDeleted: false,
      // listingStatus: "approved",
      "location.city": new RegExp(city, "i"),
      propertyType: propertyType,
      "pricing.minOneNightPrice": {
        $gte: basePrice - 2000,
        $lte: basePrice + 2000,
      },
    })
      .sort({ guestAverageRating: -1 })
      .limit(6);

    // 2️⃣ If less than 3 results → remove price filter
    if (similarProperties.length < 3) {
      similarProperties = await PropertyInfo.find({
        _id: { $ne: propertyId },
        // isDeleted: false,
        // listingStatus: "approved",
        "location.city": new RegExp(city, "i"),
        propertyType: propertyType,
      })
        .sort({ guestAverageRating: -1 })
        .limit(6);
    }

    // 3️⃣ If still empty → match only by city
    if (similarProperties.length === 0) {
      similarProperties = await PropertyInfo.find({
        _id: { $ne: propertyId },
        // isDeleted: false,
        // listingStatus: "approved",
        "location.city": new RegExp(city, "i"),
      })
        .sort({ guestAverageRating: -1 })
        .limit(6);
    }

    res.status(200).json({
      success: true,
      total: similarProperties.length,
      data: similarProperties,
    });
  } catch (error) {
    console.error("Similar property error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch similar properties",
    });
  }
};

// ---------------------------------------
// Controller — Update PAN & Aadhaar
// ---------------------------------------
export const updatePanAadhar = async (req, res) => {
  try {
    const {
      propertyId,
      panNumber,
      panFront,
      panBack,
      aadharNumber,
      aadharFront,
      aadharBack,
    } = req.body;

    if (!propertyId) {
      return res.status(400).json({ message: "propertyId is required" });
    }

    const property = await PropertyInfo.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (
      !panNumber ||
      !panFront ||
      !panBack ||
      !panFront ||
      !aadharNumber ||
      !aadharFront ||
      !aadharBack
    ) {
      return res.status(400).json({
        success: false,
        message: "Both Pan and Aadhar Card all details required",
      });
    }

    property.pan = {
      number: panNumber,
      front: panFront,
      back: panBack,
    };

    property.aadhar = {
      number: aadharNumber,
      front: aadharFront,
      back: aadharBack,
    };

    property.screenNumber = 90;

    await property.save();

    res.status(200).json({
      message: "PAN & Aadhaar updated successfully",
      property,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ---------------------------------------
// Controller — Update Bank Details
// ---------------------------------------
export const updateBankDetails = async (req, res) => {
  try {
    const { propertyId, bankName, accountNumber, ifscCode } = req.body;

    if (!propertyId) {
      return res.status(400).json({ message: "propertyId required" });
    }

    const property = await PropertyInfo.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    property.bankDetails = {
      name: bankName,
      accountNumber: accountNumber,
      ifscCode: ifscCode,
    };

    property.screenNumber = 91;

    await property.save();

    res.status(200).json({
      message: "Bank details updated successfully",
      property,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ---------------------------------------------
// Controller — Update GST & Business License
// ---------------------------------------------
export const updateGstBusinessLicense = async (req, res) => {
  try {
    const {
      propertyId,
      gstNumber,
      gstFront,
      gstBack,
      licenseNumber,
      licenseFront,
      licenseBack,
    } = req.body;

    if (!propertyId) {
      return res.status(400).json({ message: "propertyId required" });
    }

    const property = await PropertyInfo.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    property.gst = {
      number: gstNumber,
      front: gstFront,
      back: gstBack,
    };

    property.businessLicense = {
      number: licenseNumber,
      front: licenseFront,
      back: licenseBack,
    };

    property.screenNumber = 92;

    await property.save();

    res.status(200).json({
      message: "GST & Business License updated successfully",
      property,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
