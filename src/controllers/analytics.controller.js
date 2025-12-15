import mongoose from "mongoose";
import RoomBooking from "../models/roomBooking.model.js";
import PropertyRoom from "../models/propertyRoom.model.js";

// Helpers
const startOfDayUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
const endOfDayUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

const parsePeriod = ({ period = "today", from, to }) => {
  const now = new Date();
  let start, end;
  if (period === "today") {
    start = startOfDayUTC(now);
    end = endOfDayUTC(now);
  } else if (period === "this_week") {
    const day = now.getUTCDay(); // 0=Sun
    const diffToMon = (day + 6) % 7; // days since Monday
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - diffToMon);
    start = startOfDayUTC(monday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    end = endOfDayUTC(sunday);
  } else if (period === "this_month") {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    start = startOfDayUTC(first);
    end = endOfDayUTC(last);
  } else if (period === "custom" && from && to) {
    start = startOfDayUTC(new Date(`${from}T00:00:00.000Z`));
    end = endOfDayUTC(new Date(`${to}T00:00:00.000Z`));
  } else {
    start = startOfDayUTC(now);
    end = endOfDayUTC(now);
  }
  return { start, end };
};

// GET /api/analytics/summary
// Query: period=today|this_week|this_month|custom, from, to, propertyId?
export const getAnalyticsSummary = async (req, res) => {
  try {
    const { period, from, to, propertyId } = req.query;
    const { start, end } = parsePeriod({ period, from, to });

    const match = {
      createdAt: { $gte: start, $lte: end },
    };
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      match.propertyId = new mongoose.Types.ObjectId(propertyId);
    }

    // Bookings count (created in range)
    const bookingsCount = await RoomBooking.countDocuments(match);

    // Check-ins and Check-outs in range (use stayDetails dates if present)
    const checkinMatch = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      checkinMatch.propertyId = new mongoose.Types.ObjectId(propertyId);
    }
    checkinMatch["stayDetails.checkInDate"] = { $gte: start, $lte: end };
    const checkins = await RoomBooking.countDocuments(checkinMatch);

    const checkoutMatch = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      checkoutMatch.propertyId = new mongoose.Types.ObjectId(propertyId);
    }
    checkoutMatch["stayDetails.checkOutDate"] = { $gte: start, $lte: end };
    const checkouts = await RoomBooking.countDocuments(checkoutMatch);

    // Revenue and room-nights from bookings overlapping the period
    const overlapMatch = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) overlapMatch.propertyId = new mongoose.Types.ObjectId(propertyId);
    overlapMatch.$or = [
      { "stayDetails.checkInDate": { $lte: end }, "stayDetails.checkOutDate": { $gte: start } },
    ];

    const overlaps = await RoomBooking.find(overlapMatch).select("priceSummary stayDetails source").lean();

    let totalRevenue = 0; // sum of paid amount; fallback to priceSummary.totalPaid/basePrice
    let consumedRoomNights = 0; // nights in period

    for (const b of overlaps) {
      const price = b.priceSummary || {};
      const paid = typeof price.totalPaid === "number" ? price.totalPaid : (typeof price.basePrice === "number" ? price.basePrice : 0);
      totalRevenue += paid;

      const cin = b.stayDetails?.checkInDate ? new Date(b.stayDetails.checkInDate) : null;
      const cout = b.stayDetails?.checkOutDate ? new Date(b.stayDetails.checkOutDate) : null;
      if (cin && cout) {
        // overlap nights
        const s = cin > start ? cin : start;
        const e = cout < end ? cout : end;
        const msPerNight = 24 * 3600 * 1000;
        const nights = Math.max(0, Math.round((endOfDayUTC(e).getTime() - startOfDayUTC(s).getTime()) / msPerNight));
        consumedRoomNights += nights;
      }
    }

    // Available room nights = number of rooms * days in range
    let roomsCount = 0;
    const roomFilter = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) roomFilter.propertyId = new mongoose.Types.ObjectId(propertyId);
    const rooms = await PropertyRoom.find(roomFilter).select("numberOfRooms").lean();
    for (const r of rooms) roomsCount += (r.numberOfRooms || 1);

    const msPerDay = 24 * 3600 * 1000;
    const daysInRange = Math.max(1, Math.round((endOfDayUTC(end).getTime() - startOfDayUTC(start).getTime()) / msPerDay) + 1);
    const availableRoomNights = roomsCount * daysInRange;

    const occupancyRate = availableRoomNights > 0 ? (consumedRoomNights / availableRoomNights) * 100 : 0;
    const ADR = consumedRoomNights > 0 ? totalRevenue / consumedRoomNights : 0;
    const RevPAR = availableRoomNights > 0 ? totalRevenue / availableRoomNights : 0;

    // Booking sources breakdown
    const sourceAgg = await RoomBooking.aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ["$source", "Direct"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const totalSrc = sourceAgg.reduce((a, b) => a + b.count, 0) || 1;
    const sources = sourceAgg.map((s) => ({ name: s._id, percent: Math.round((s.count / totalSrc) * 100) }));

    res.status(200).json({
      success: true,
      period: { start, end },
      data: {
        bookings: bookingsCount,
        checkins,
        checkouts,
        occupancyRate: Number(occupancyRate.toFixed(1)),
        ADR: Math.round(ADR),
        RevPAR: Math.round(RevPAR),
        sources,
      },
    });
  } catch (error) {
    console.error("Error getAnalyticsSummary:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
