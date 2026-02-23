import mongoose from "mongoose";
import RoomInventory from "../models/roomInventory.model.js";
import PropertyRoom from "../models/propertyRoom.model.js";

const parseISODate = (s) => new Date(`${s}T00:00:00.000Z`);
const formatISODate = (d) => d.toISOString().slice(0, 10);

const timeToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const isOverlap = (aStart, aEnd, bStart, bEnd) => {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
};

const minutesToTime = (m) => {
  String(Math.floor(m / 60)).padStart(2, "0") +
    ":" +
    String(m % 60).padStart(2, "0");
};

function reminderTime(time) {
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

// normalize inventory day response with all keys present
const normalizeDay = (doc) => {
  const d = doc || {};
  return {
    _id: d._id || null,
    roomId: String(d.roomId || ""),
    date: d.date || null,
    allotment: typeof d.allotment === "number" ? d.allotment : 0,
    open: d.open !== false,
    stopSell: d.stopSell === true,
    notes: d.notes || "",
    sellStatus: d.sellStatus || "sellable",
    nonSellReasons: Array.isArray(d.nonSellReasons) ? d.nonSellReasons : [],
    baseRateSummary: {
      roomOnly: d.baseRateSummary?.roomOnly ?? 0,
      cp: d.baseRateSummary?.cp ?? 0,
    },
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
      cp: {
        baseAdults: d.ratePlans?.cp?.baseAdults ?? 3,
        adults: {
          a1: d.ratePlans?.cp?.adults?.a1 ?? null,
          a2: d.ratePlans?.cp?.adults?.a2 ?? null,
          a3: d.ratePlans?.cp?.adults?.a3 ?? null,
        },
        perChild0to8Free: d.ratePlans?.cp?.perChild0to8Free !== false,
        perChild9to12: d.ratePlans?.cp?.perChild9to12 ?? null,
        perExtraAdult: d.ratePlans?.cp?.perExtraAdult ?? null,
      },
    },
    restrictions: {
      minAdvanceBookingTime: d.restrictions?.minAdvanceBookingTime || "11:59PM",
      bookingWindowDays: d.restrictions?.bookingWindowDays ?? 450,
      maxAdvanceDays: d.restrictions?.maxAdvanceDays ?? 450,
      minLOS: d.restrictions?.minLOS ?? 1,
      maxLOS: d.restrictions?.maxLOS ?? 450,
    },
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
};

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

    const rooms = await PropertyRoom.find(roomFilter)
      .select("_id type price.oneNight")
      .lean();
    const roomIds = rooms.map((r) => r._id);

    // Pull inventory for the month for those rooms
    const invFilter = { date: { $gte: start, $lt: end } };
    if (roomIds.length > 0) invFilter.roomId = { $in: roomIds };
    const rows = await RoomInventory.find(invFilter)
      .sort({ roomId: 1, date: 1 })
      .lean();

    // Build date keys for the whole month
    const dates = [];
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(formatISODate(d));
    }

    // Index inventory by roomId+date
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
          baseRateSummary: {
            roomOnly: rec?.baseRateSummary?.roomOnly ?? 0,
            cp: rec?.baseRateSummary?.cp ?? 0,
          },
        };
      });
      return {
        roomId: String(room._id),
        roomName: room.type || "",
        type: room.type || "",
        open: true,
        baseRate: room?.price?.oneNight ?? 0,
        plans: {
          roomOnly: {
            price: room?.price?.oneNight ?? 0,
            hasRate: (room?.price?.oneNight ?? 0) > 0,
          },
          cp: { price: null, hasRate: false },
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

// Get a single inventory day
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

// Patch a single inventory day (partial)
export const patchInventoryDay = async (req, res) => {
  try {
    const { roomId, date } = req.params;
    const allowed = [
      "allotment",
      "open",
      "stopSell",
      "notes",
      "sellStatus",
      "nonSellReasons",
      "baseRateSummary",
      "ratePlans",
      "restrictions",
    ];
    const set = {};
    for (const k of allowed) {
      if (typeof req.body[k] !== "undefined") set[k] = req.body[k];
    }
    const updated = await RoomInventory.findOneAndUpdate(
      { roomId, date: parseISODate(date) },
      { $set: set },
      { new: true, upsert: true, runValidators: true },
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

// Update only day rates and restrictions
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
      { new: true, upsert: true, runValidators: true },
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

// Delete a day
export const deleteInventoryDay = async (req, res) => {
  try {
    const { roomId, date } = req.params;
    const out = await RoomInventory.findOneAndDelete({
      roomId,
      date: parseISODate(date),
    });
    return res.status(200).json({
      success: true,
      message: out ? "Deleted" : "No record",
      data: normalizeDay(out || { roomId, date: parseISODate(date) }),
    });
  } catch (error) {
    console.error("Error deleteInventoryDay:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const upsertInventoryDay = async (req, res) => {
  try {
    const { roomId, date } = req.params;
    const { allotment, open, stopSell, notes } = req.body;

    const doc = await RoomInventory.findOneAndUpdate(
      { roomId, date: parseISODate(date) },
      { $set: { allotment, open, stopSell, notes } },
      { new: true, upsert: true, runValidators: true },
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
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        d.getUTCDay()
      ];
      if (!applyOn || applyOn.includes(dow)) days.push(new Date(d));
    }

    let affected = 0;
    for (const id of roomIds) {
      for (const d of days) {
        const resu = await RoomInventory.updateOne(
          { roomId: id, date: d },
          { $set: { allotment, open, stopSell } },
          { upsert: true },
        );
        affected += resu.matchedCount + resu.upsertedCount || 1;
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

    const resu = await RoomInventory.updateMany(
      { roomId: { $in: roomIds }, date: { $gte: start, $lte: end } },
      { $set: { open } },
    );

    res.status(200).json({
      success: true,
      message: "Open/close updated",
      data: {
        matched: resu.matchedCount ?? resu.n,
        modified: resu.modifiedCount ?? resu.nModified,
      },
    });
  } catch (error) {
    console.error("Error toggleOpenClose:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const saveBulkChanges = async (req, res) => {
  try {
    const { inventory = [], rates = [] } = req.body;

    let invCount = 0;
    for (const i of inventory) {
      const d = parseISODate(i.date);
      const u = await RoomInventory.updateOne(
        { roomId: i.roomId, date: d },
        {
          $set: { allotment: i.allotment, open: i.open, stopSell: i.stopSell },
        },
        { upsert: true },
      );
      invCount += u.matchedCount + u.upsertedCount || 1;
    }

    // rates saved in rates.controller via dedicated endpoints; included here only for inventory portion

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

// New utility functions for time slot management
export const checkRoomSlot = async (req, res) => {
  try {
    const { roomId, date, checkInTime, plan } = req.body;

    let duration;
    if (plan === "3hr") duration = 180;
    else if (plan === "6hr") duration = 360;
    else if (plan === "night") {
      return checkNightAvailability(req, res);
    }

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
      if (isOverlap(startMin, endMin, bStart, bEnd)) {
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

const checkNightAvailability = async (req, res) => {
  const { roomId, date } = req.body;

  const startDay = parseISODate(date);
  const nextDay = new Date(startDay);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const day1 = await RoomInventory.findOne({ roomId, date: startDay });
  const day2 = await RoomInventory.findOne({ roomId, date: nextDay });

  const hasBlock = (doc) => doc?.timeBlocks?.some((b) => b.plan === "night");

  if (hasBlock(day1) || hasBlock(day2)) {
    return res.json({ success: true, available: false });
  }

  return res.json({ success: true, available: true });
};

export const blockRoomSlot = async (
  roomId,
  date,
  from,
  to,
  plan,
  bookingId,
) => {
  await RoomInventory.updateOne(
    { roomId, date: parseISODate(date) },
    {
      $push: {
        timeBlocks: { from, to, plan, bookingId },
      },
    },
    { upsert: true },
  );
};

export const getAvailableSlots = async (req, res) => {
  try {
    const { roomId, date } = req.query;

    const day = await RoomInventory.findOne({
      roomId,
      date: parseISODate(date),
    }).lean();

    const workStart = 10 * 60; // 10:00
    const workEnd = 22 * 60; // 22:00

    const booked = (day?.timeBlocks || [])
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
          from: minutesToTime(cursor),
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

    // const result = days.map(d => ({
    //   roomId: String(d.roomId),
    //   timeBlocks: d.timeBlocks || []
    // }));

    const result = days.map((d) => ({
      roomId: String(d.roomId),
      timeBlocks: (d.timeBlocks || []).map((tb) => {
        const from = reminderTime(tb.from);
        const to = reminderTime(tb.to);

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
