import mongoose from "mongoose";
import Settlement from "../models/settlement.model.js";
import RoomBooking from "../models/roomBooking.model.js";

const parseDate = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : undefined);
const dayKey = (d) => d.toISOString().slice(0, 10);

export const getRevenueSummary = async (req, res) => {
  try {
    const { propertyId, from, to } = req.query;
    const filter = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = parseDate(from);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const aggr = await Settlement.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          amount: { $sum: "$amount" },
        },
      },
    ]);

    let settledAmount = 0;
    let processingAmount = 0;
    for (const r of aggr) {
      if (r._id === "paid") settledAmount += r.amount;
      if (r._id === "processing") processingAmount += r.amount;
    }

    const total = aggr.reduce((a, b) => a + b.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: total, // using settlements total as proxy
        settledAmount,
        availableForSettlement: processingAmount,
        autoSettlementEta: null,
      },
    });
  } catch (error) {
    console.error("Error getRevenueSummary:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getRevenueFeed = async (req, res) => {
  try {
    const { groupBy = "daily", propertyId, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = parseDate(from);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    // Group settlements by day as earnings proxy
    const rows = await Settlement.find(filter).sort({ createdAt: -1 }).lean();

    const groups = new Map();
    for (const s of rows) {
      const key = dayKey(s.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }

    const periods = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));
    const start = (Number(page) - 1) * Number(limit);
    const slice = periods.slice(start, start + Number(limit));

    const data = slice.map((date) => {
      const items = groups.get(date);
      const bookingEarning = items.reduce((sum, it) => sum + (it.status === "paid" ? it.amount : 0), 0);
      return {
        period: { label: date, from: date, to: date },
        bookingEarning,
        items: items.map((s) => ({
          type: "settlement",
          title: s.status === "paid" ? "Settlement paid" : "Settlement processing",
          amount: s.amount,
          currency: s.currency,
          createdAt: s.createdAt,
          links: { settlement: `/settlements/${s._id}` },
        })),
      };
    });

    res.status(200).json({ success: true, count: data.length, total: periods.length, page: Number(page), limit: Number(limit), data });
  } catch (error) {
    console.error("Error getRevenueFeed:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getRevenueList = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, propertyId, from, to, sort = '-createdAt' } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = parseDate(from);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [rows, total] = await Promise.all([
      Settlement.find(filter).sort(sort).skip(skip).limit(Number(limit)).lean(),
      Settlement.countDocuments(filter),
    ]);

    const normalize = (s) => ({
      _id: s?._id || null,
      status: s?.status || 'processing',
      amount: s?.amount ?? 0,
      currency: s?.currency || 'INR',
      method: s?.method || '',
      settlementType: s?.settlementType || '',
      referenceId: s?.referenceId || '',
      paidAt: s?.paidAt || null,
      createdAt: s?.createdAt || null,
      updatedAt: s?.updatedAt || null,
      bank: {
        ifsc: s?.bank?.ifsc || '',
        accountName: s?.bank?.accountName || '',
        accountMask: s?.bank?.accountMask || '',
      },
      timeline: Array.isArray(s?.timeline)
        ? s.timeline.map((t) => ({ at: t?.at || null, status: t?.status || '', note: t?.note || '', referenceId: t?.referenceId || '' }))
        : [],
      links: {
        settlement: s?._id ? `/settlements/${s._id}` : '',
      },
    });

    const data = rows.map(normalize);
    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error getRevenueList:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const getBookingRevenueDetail = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await RoomBooking.findById(bookingId).lean();
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // Best-effort mapping depending on your RoomBooking fields
    const price = booking.priceSummary || booking.price || {};

    res.status(200).json({
      success: true,
      data: {
        bookingId: booking._id,
        guest: booking.guestDetails || {},
        room: booking.room || {},
        price: {
          base: price.basePrice ?? 0,
          discount: price.discount ?? 0,
          taxAndFees: price.taxAndFees ?? 0,
          paid: price.totalPaid ?? 0,
        },
        platformFee: booking.platformFee ?? 0,
        hotelRevenue: booking.hotelRevenue ?? (price.totalPaid ?? 0) - (booking.platformFee ?? 0),
        checkIn: booking.stayDetails?.checkInDate,
        checkOut: booking.stayDetails?.checkOutDate,
      },
    });
  } catch (error) {
    console.error("Error getBookingRevenueDetail:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
