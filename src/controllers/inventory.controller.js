import mongoose from "mongoose";
import RoomInventory from "../models/roomInventory.model.js";
import PropertyRoom from "../models/propertyRoom.model.js";

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

const parseISODate = (s) => new Date(`${s}T00:00:00.000Z`);
const formatISODate = (d) => d.toISOString().slice(0, 10);

const timeToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const isOverlap = (aStart, aEnd, bStart, bEnd) => {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
};

// FIX: was missing `return` — caused getAvailableSlots to return undefined from/to
const minutesToTime = (m) =>
  String(Math.floor(m / 60)).padStart(2, "0") +
  ":" +
  String(m % 60).padStart(2, "0");

// Normalise a stored time string that may carry hours >= 24 (cross-midnight slots)
function normalizeTime(time) {
  let [h, m] = time.split(":").map(Number);
  let nextDay = false;

  if (h >= 24) {
    h = h - 24;
    nextDay = true;
  }

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");

  return { time: `${hh}:${mm}`, nextDay };
}

// ─────────────────────────────────────────────
// Normalize a RoomInventory document for API responses.
// FIX: removed all references to `cp`; schema uses `withBreakfast`.
// ─────────────────────────────────────────────
const normalizeDay = (doc) => {
  const d = doc || {};
  return {
    _id: d._id || null,
    roomId: String(d.roomId || ""),
    date: d.date || null,
    allotment: typeof d.allotment === "number" ? d.allotment : 0,
    bookedRoomNumbers: Array.isArray(d.bookedRoomNumbers)
      ? d.bookedRoomNumbers
      : [],
    open: d.open !== false,
    stopSell: d.stopSell === true,
    notes: d.notes || "",
    sellStatus: d.sellStatus || "sellable",
    nonSellReasons: Array.isArray(d.nonSellReasons) ? d.nonSellReasons : [],

    // FIX: schema field is `withBreakfast`, not `cp`
    baseRateSummary: {
      roomOnly: d.baseRateSummary?.roomOnly ?? 0,
      withBreakfast: d.baseRateSummary?.withBreakfast ?? 0,
    },

    // FIX: schema ratePlans has `roomOnly` and `withBreakfast` — removed `cp`
    ratePlans: {
      roomOnly: {
        baseAdults: d.ratePlans?.roomOnly?.baseAdults ?? 3,
        adults: {
          a1: d.ratePlans?.roomOnly?.adults?.a1 ?? null,
          a2: d.ratePlans?.roomOnly?.adults?.a2 ?? null,
          a3: d.ratePlans?.roomOnly?.adults?.a3 ?? null,
        },
        perChild0to8Free: d.ratePlans?.roomOnly?.perChild0to8Free !== false,
        perChild9to12: d.ratePlans?.roomOnly?.perChild9to12 ?? null,
        perExtraAdult: d.ratePlans?.roomOnly?.perExtraAdult ?? null,
      },
      withBreakfast: {
        baseAdults: d.ratePlans?.withBreakfast?.baseAdults ?? 3,
        adults: {
          a1: d.ratePlans?.withBreakfast?.adults?.a1 ?? null,
          a2: d.ratePlans?.withBreakfast?.adults?.a2 ?? null,
          a3: d.ratePlans?.withBreakfast?.adults?.a3 ?? null,
        },
        perChild0to8Free:
          d.ratePlans?.withBreakfast?.perChild0to8Free !== false,
        perChild9to12: d.ratePlans?.withBreakfast?.perChild9to12 ?? null,
        perExtraAdult: d.ratePlans?.withBreakfast?.perExtraAdult ?? null,
      },
    },

    restrictions: {
      minAdvanceBookingTime:
        d.restrictions?.minAdvanceBookingTime || "11:59PM",
      bookingWindowDays: d.restrictions?.bookingWindowDays ?? 450,
      maxAdvanceDays: d.restrictions?.maxAdvanceDays ?? 450,
      minLOS: d.restrictions?.minLOS ?? 1,
      maxLOS: d.restrictions?.maxLOS ?? 450,
    },

    timeBlocks: Array.isArray(d.timeBlocks) ? d.timeBlocks : [],
    nightBlock: d.nightBlock || {
      bookingId: null,
      roomNumber: null,
      checkOutTime: null,
      isBooked: false,
    },
    dateToDateLock: d.dateToDateLock || {
      bookingId: null,
      roomNumber: null,
      isBooked: false,
    },

    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
};

// ─────────────────────────────────────────────
// GET /inventory/calendar?month=YYYY-MM&propertyId=&roomId=
// ─────────────────────────────────────────────
export const getInventoryCalendar = async (req, res) => {
  try {
    const { month, roomId, propertyId } = req.query;
    if (!month)
      return res
        .status(400)
        .json({ success: false, message: "month (YYYY-MM) is required" });

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    // Determine rooms to include
    let roomFilter = {};
    if (roomId) {
      const roomIds = Array.isArray(roomId) ? roomId : [roomId];
      roomFilter._id = {
        $in: roomIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    } else if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      roomFilter.propertyId = new mongoose.Types.ObjectId(propertyId);
    }

    // FIX: `price` field does not exist — schema uses `pricing` with nested mealPricingSchema
    const rooms = await PropertyRoom.find(roomFilter)
      .select("_id type pricing")
      .lean();

    const roomIds = rooms.map((r) => r._id);

    // Pull inventory for the month
    const invFilter = { date: { $gte: start, $lt: end } };
    if (roomIds.length > 0) invFilter.roomId = { $in: roomIds };

    const rows = await RoomInventory.find(invFilter)
      .sort({ roomId: 1, date: 1 })
      .lean();

    // Build date list for the whole month
    const dates = [];
    for (
      let d = new Date(start);
      d < end;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      dates.push(formatISODate(d));
    }

    // Index inventory by roomId|date
    const idx = new Map();
    for (const r of rows) {
      const key = `${String(r.roomId)}|${formatISODate(r.date)}`;
      idx.set(key, r);
    }

    // Compose response per room
    const data = rooms.map((room) => {
      const days = dates.map((dt) => {
        const rec = idx.get(`${String(room._id)}|${dt}`);
        return {
          date: dt,
          allotment: rec?.allotment ?? 0,
          open: rec?.open ?? true,
          stopSell: rec?.stopSell ?? false,
          sellStatus: rec?.sellStatus || "sellable",
          nonSellReasons: Array.isArray(rec?.nonSellReasons)
            ? rec.nonSellReasons
            : [],
          // FIX: schema uses `withBreakfast`, not `cp`
          baseRateSummary: {
            roomOnly: rec?.baseRateSummary?.roomOnly ?? 0,
            withBreakfast: rec?.baseRateSummary?.withBreakfast ?? 0,
          },
        };
      });

      // FIX: pricing.oneNight is a mealPricingSchema object { roomOnly, withBreakfast }
      const oneNightRoomOnly = room?.pricing?.oneNight?.roomOnly ?? 0;
      const oneNightWithBreakfast =
        room?.pricing?.oneNight?.withBreakfast ?? 0;

      return {
        roomId: String(room._id),
        roomName: room.type || "",
        type: room.type || "",
        open: true,
        // FIX: `price.oneNight` does not exist — using correct nested path
        baseRate: oneNightRoomOnly,
        plans: {
          roomOnly: {
            price: oneNightRoomOnly,
            hasRate: oneNightRoomOnly > 0,
          },
          // FIX: `cp` does not exist — replaced with `withBreakfast`
          withBreakfast: {
            price: oneNightWithBreakfast,
            hasRate: oneNightWithBreakfast > 0,
          },
        },
        days,
      };
    });

    return res.status(200).json({
      success: true,
      meta: {
        month,
        from: formatISODate(start),
        to: formatISODate(new Date(end.getTime() - 86400000)),
        daysInMonth: dates.length,
      },
      data,
    });
  } catch (error) {
    console.error("Error getInventoryCalendar:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /inventory/:roomId/:date
// ─────────────────────────────────────────────
export const getInventoryDay = async (req, res) => {
  try {
    const { roomId, date } = req.params;
    const doc = await RoomInventory.findOne({
      roomId,
      date: parseISODate(date),
    });
    if (!doc)
      return res.status(200).json({
        success: true,
        data: normalizeDay({ roomId, date: parseISODate(date) }),
      });
    return res.status(200).json({ success: true, data: normalizeDay(doc) });
  } catch (error) {
    console.error("Error getInventoryDay:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /inventory/:roomId/:date
// FIX: added all valid schema top-level fields to `allowed`
// ─────────────────────────────────────────────
export const patchInventoryDay = async (req, res) => {
  try {
    const { roomId, date } = req.params;

    // FIX: added bookedRoomNumbers, timeBlocks, nightBlock, dateToDateLock
    const allowed = [
      "allotment",
      "bookedRoomNumbers",
      "open",
      "stopSell",
      "notes",
      "sellStatus",
      "nonSellReasons",
      "baseRateSummary",
      "ratePlans",
      "restrictions",
      "timeBlocks",
      "nightBlock",
      "dateToDateLock",
    ];

    const set = {};
    for (const k of allowed) {
      if (typeof req.body[k] !== "undefined") set[k] = req.body[k];
    }

    const updated = await RoomInventory.findOneAndUpdate(
      { roomId, date: parseISODate(date) },
      { $set: set },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Inventory day updated",
      data: normalizeDay(updated),
    });
  } catch (error) {
    console.error("Error patchInventoryDay:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /inventory/:roomId/:date/rates
// ─────────────────────────────────────────────
export const updateDayRatesAndRestrictions = async (req, res) => {
  try {
    const { roomId, date } = req.params;
    const { baseRateSummary, ratePlans, restrictions } = req.body;

    const set = {};
    if (baseRateSummary) set.baseRateSummary = baseRateSummary;
    if (ratePlans) set.ratePlans = ratePlans;
    if (restrictions) set.restrictions = restrictions;

    const updated = await RoomInventory.findOneAndUpdate(
      { roomId, date: parseISODate(date) },
      { $set: set },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Rates & restrictions updated",
      data: normalizeDay(updated),
    });
  } catch (error) {
    console.error("Error updateDayRatesAndRestrictions:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /inventory/:roomId/:date
// ─────────────────────────────────────────────
export const deleteInventoryDay = async (req, res) => {
  try {
    const { roomId, date } = req.params;
    const out = await RoomInventory.findOneAndDelete({
      roomId,
      date: parseISODate(date),
    });
    return res.status(200).json({
      success: true,
      message: out ? "Deleted" : "No record found",
      data: normalizeDay(out || { roomId, date: parseISODate(date) }),
    });
  } catch (error) {
    console.error("Error deleteInventoryDay:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /inventory/:roomId/:date/upsert
// ─────────────────────────────────────────────
export const upsertInventoryDay = async (req, res) => {
  try {
    const { roomId, date } = req.params;
    const { allotment, open, stopSell, notes } = req.body;

    const doc = await RoomInventory.findOneAndUpdate(
      { roomId, date: parseISODate(date) },
      { $set: { allotment, open, stopSell, notes } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Inventory upserted",
      data: {
        roomId: doc.roomId,
        date,
        allotment: doc.allotment,
        open: doc.open,
        stopSell: doc.stopSell,
      },
    });
  } catch (error) {
    console.error("Error upsertInventoryDay:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /inventory/bulk
// ─────────────────────────────────────────────
export const bulkInventory = async (req, res) => {
  try {
    const {
      roomIds = [],
      dateFrom,
      dateTo,
      applyOn,
      allotment,
      open,
      stopSell,
    } = req.body;

    if (!Array.isArray(roomIds) || roomIds.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "roomIds is required" });
    if (!dateFrom || !dateTo)
      return res
        .status(400)
        .json({ success: false, message: "dateFrom and dateTo are required" });

    const start = parseISODate(dateFrom);
    const end = parseISODate(dateTo);
    const days = [];

    for (
      let d = new Date(start);
      d <= end;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        d.getUTCDay()
      ];
      if (!applyOn || applyOn.includes(dow)) days.push(new Date(d));
    }

    let affected = 0;
    for (const id of roomIds) {
      for (const d of days) {
        const result = await RoomInventory.updateOne(
          { roomId: id, date: d },
          { $set: { allotment, open, stopSell } },
          { upsert: true }
        );
        affected += result.matchedCount + result.upsertedCount || 1;
      }
    }

    res.status(200).json({
      success: true,
      message: "Inventory updated",
      data: { affected },
    });
  } catch (error) {
    console.error("Error bulkInventory:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /inventory/toggle-open
// ─────────────────────────────────────────────
export const toggleOpenClose = async (req, res) => {
  try {
    const { roomIds = [], dateFrom, dateTo, open } = req.body;

    if (!Array.isArray(roomIds) || roomIds.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "roomIds is required" });
    if (!dateFrom || !dateTo)
      return res
        .status(400)
        .json({ success: false, message: "dateFrom and dateTo are required" });

    const start = parseISODate(dateFrom);
    const end = parseISODate(dateTo);

    const result = await RoomInventory.updateMany(
      { roomId: { $in: roomIds }, date: { $gte: start, $lte: end } },
      { $set: { open } }
    );

    res.status(200).json({
      success: true,
      message: "Open/close updated",
      data: {
        matched: result.matchedCount ?? result.n,
        modified: result.modifiedCount ?? result.nModified,
      },
    });
  } catch (error) {
    console.error("Error toggleOpenClose:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /inventory/bulk-save
// ─────────────────────────────────────────────
export const saveBulkChanges = async (req, res) => {
  try {
    const { inventory = [] } = req.body;

    let invCount = 0;
    for (const i of inventory) {
      const d = parseISODate(i.date);
      const u = await RoomInventory.updateOne(
        { roomId: i.roomId, date: d },
        {
          $set: {
            allotment: i.allotment,
            open: i.open,
            stopSell: i.stopSell,
          },
        },
        { upsert: true }
      );
      invCount += u.matchedCount + u.upsertedCount || 1;
    }

    res.status(200).json({
      success: true,
      message: "Changes saved",
      data: { inventoryUpserts: invCount, rateUpserts: 0 },
    });
  } catch (error) {
    console.error("Error saveBulkChanges:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /inventory/check-slot
// ─────────────────────────────────────────────
export const checkRoomSlot = async (req, res) => {
  try {
    const { roomId, date, checkInTime, plan } = req.body;

    // FIX: night plan is handled via nightBlock, not timeBlocks
    if (plan === "night") {
      return checkNightAvailability(req, res);
    }

    let duration;
    if (plan === "3hr") duration = 180;
    else if (plan === "6hr") duration = 360;
    else
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan. Use 3hr, 6hr, or night." });

    const startMin = timeToMinutes(checkInTime);
    const endMin = startMin + duration;

    const doc = await RoomInventory.findOne({
      roomId,
      date: parseISODate(date),
    });

    if (!doc) {
      return res.json({ success: true, available: true });
    }

    for (const b of doc.timeBlocks) {
      const bStart = timeToMinutes(b.from);
      const bEnd = timeToMinutes(b.to);
      if (b.isBooked && isOverlap(startMin, endMin, bStart, bEnd)) {
        return res.json({
          success: true,
          available: false,
          conflict: b,
        });
      }
    }

    return res.json({ success: true, available: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────
// Internal: check nightBlock availability across two days
// FIX: schema has a dedicated `nightBlock` subdoc — not a timeBlocks entry with plan "night"
// ─────────────────────────────────────────────
const checkNightAvailability = async (req, res) => {
  const { roomId, date } = req.body;

  const startDay = parseISODate(date);
  const nextDay = new Date(startDay);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const [day1, day2] = await Promise.all([
    RoomInventory.findOne({ roomId, date: startDay }),
    RoomInventory.findOne({ roomId, date: nextDay }),
  ]);

  // FIX: check nightBlock.isBooked — `plan: "night"` does not exist in timeBlocks enum
  const isNightBooked = (doc) => doc?.nightBlock?.isBooked === true;

  if (isNightBooked(day1) || isNightBooked(day2)) {
    return res.json({ success: true, available: false });
  }

  return res.json({ success: true, available: true });
};

// ─────────────────────────────────────────────
// Internal utility: push a time block onto an inventory day.
// FIX: now sets isBooked: true and accepts roomNumber
// ─────────────────────────────────────────────
export const blockRoomSlot = async (
  roomId,
  date,
  from,
  to,
  plan,
  bookingId,
  roomNumber = null
) => {
  await RoomInventory.updateOne(
    { roomId, date: parseISODate(date) },
    {
      $push: {
        // FIX: isBooked: true and roomNumber were missing
        timeBlocks: { from, to, plan, bookingId, roomNumber, isBooked: true },
      },
    },
    { upsert: true }
  );
};

// ─────────────────────────────────────────────
// GET /inventory/available-slots?roomId=&date=
// FIX: minutesToTime was missing return — free slot from/to were always undefined
// ─────────────────────────────────────────────
export const getAvailableSlots = async (req, res) => {
  try {
    const { roomId, date } = req.query;

    const day = await RoomInventory.findOne({
      roomId,
      date: parseISODate(date),
    }).lean();

    const workStart = 10 * 60; // 10:00
    const workEnd = 22 * 60;   // 22:00

    // Only consider actually booked blocks
    const booked = (day?.timeBlocks || [])
      .filter((b) => b.isBooked)
      .map((b) => ({
        start: timeToMinutes(b.from),
        end: timeToMinutes(b.to),
      }))
      .sort((a, b) => a.start - b.start);

    const free = [];
    let cursor = workStart;

    for (const b of booked) {
      if (b.start > cursor) {
        free.push({
          from: minutesToTime(cursor),   // FIX: now returns actual string
          to: minutesToTime(b.start),
        });
      }
      cursor = Math.max(cursor, b.end);
    }

    if (cursor < workEnd) {
      free.push({
        from: minutesToTime(cursor),
        to: minutesToTime(workEnd),
      });
    }

    res.json({ success: true, freeSlots: free });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /inventory/blocked-slots?date=&roomId=&propertyId=
// ─────────────────────────────────────────────
export const getBlockedSlotsOfDay = async (req, res) => {
  try {
    const { propertyId, roomId, date } = req.query;

    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: "date is required" });
    }

    const filter = { date: parseISODate(date) };

    if (roomId) {
      filter.roomId = roomId;
    } else if (propertyId) {
      const rooms = await PropertyRoom.find({ propertyId })
        .select("_id")
        .lean();
      const roomIds = rooms.map((r) => r._id);
      filter.roomId = { $in: roomIds };
    } else {
      return res.status(400).json({
        success: false,
        message: "roomId or propertyId is required",
      });
    }

    const days = await RoomInventory.find(filter)
      .select("roomId timeBlocks")
      .lean();

    const result = days.map((d) => ({
      roomId: String(d.roomId),
      timeBlocks: (d.timeBlocks || []).map((tb) => {
        const from = normalizeTime(tb.from);
        const to = normalizeTime(tb.to);
        return {
          ...tb,
          from: from.time,
          to: to.time,
          crossesMidnight: to.nextDay || from.nextDay,
        };
      }),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};