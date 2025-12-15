import mongoose from "mongoose";
import RoomRate from "../models/roomRate.model.js";

const parseISODate = (s) => new Date(`${s}T00:00:00.000Z`);
const formatISODate = (d) => d.toISOString().slice(0, 10);

const priority = { override: 3, seasonal: 2, base: 1 };

export const getRatesCalendar = async (req, res) => {
  try {
    const { month, roomId, plans = "RO,CP" } = req.query;
    if (!month) return res.status(400).json({ success: false, message: "month (YYYY-MM) is required" });

    const planList = Array.isArray(plans) ? plans : String(plans).split(",").map((p) => p.trim()).filter(Boolean);

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const filter = { date: { $gte: start, $lt: end } };
    if (roomId) {
      const roomIds = Array.isArray(roomId) ? roomId : [roomId];
      filter.roomId = { $in: roomIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const rows = await RoomRate.find(filter).sort({ roomId: 1, date: 1 });

    const grouped = new Map();
    for (const r of rows) {
      const key = String(r.roomId);
      if (!grouped.has(key)) grouped.set(key, new Map());
      const days = grouped.get(key);
      const dayKey = formatISODate(r.date);
      if (!days.has(dayKey)) days.set(dayKey, {});
      const day = days.get(dayKey);
      // choose by priority per plan
      const current = day[r.plan];
      if (!current || priority[r.overrideLevel] > priority[current.overrideLevel || "base"]) {
        day[r.plan] = { price: r.price, overrideLevel: r.overrideLevel, extraAdultPrice: r.extraAdultPrice, extraChildPrice: r.extraChildPrice, taxIncluded: r.taxIncluded, currency: r.currency };
      }
    }

    const data = Array.from(grouped.entries()).map(([rid, days]) => ({
      roomId: rid,
      days: Array.from(days.entries()).map(([date, plansObj]) => ({ date, plans: plansObj }))
    }));

    res.status(200).json({ success: true, meta: { month, plans: planList }, data });
  } catch (error) {
    console.error("Error getRatesCalendar:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const upsertRateDay = async (req, res) => {
  try {
    const { roomId, date, plan } = req.params;
    const { price, extraAdultPrice, extraChildPrice, taxIncluded = true, currency = "INR", overrideLevel = "override" } = req.body;
    if (typeof price !== "number") return res.status(400).json({ success: false, message: "price is required" });

    const doc = await RoomRate.findOneAndUpdate(
      { roomId, date: parseISODate(date), plan, overrideLevel },
      { $set: { price, extraAdultPrice, extraChildPrice, taxIncluded, currency } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, message: "Rate upserted", data: { roomId: doc.roomId, date, plan: doc.plan, price: doc.price, overrideLevel: doc.overrideLevel } });
  } catch (error) {
    console.error("Error upsertRateDay:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const bulkRates = async (req, res) => {
  try {
    const { roomIds = [], plans = [], dateFrom, dateTo, applyOn, price, planPrices, extraAdultPrice, extraChildPrice, overrideLevel = "override" } = req.body;
    if (!Array.isArray(roomIds) || roomIds.length === 0) return res.status(400).json({ success: false, message: "roomIds is required" });
    if (!dateFrom || !dateTo) return res.status(400).json({ success: false, message: "dateFrom and dateTo are required" });

    const start = parseISODate(dateFrom);
    const end = parseISODate(dateTo);
    const days = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getUTCDay()];
      if (!applyOn || applyOn.includes(dow)) days.push(new Date(d));
    }

    const planList = plans.length ? plans : Object.keys(planPrices || { RO: price });
    if ((!price && !planPrices) || planList.length === 0) return res.status(400).json({ success: false, message: "Provide price or planPrices" });

    let affected = 0;
    for (const id of roomIds) {
      for (const d of days) {
        for (const p of planList) {
          const pPrice = planPrices ? planPrices[p] : price;
          if (typeof pPrice !== "number") continue;
          const resu = await RoomRate.updateOne(
            { roomId: id, date: d, plan: p, overrideLevel },
            { $set: { price: pPrice, extraAdultPrice, extraChildPrice } },
            { upsert: true }
          );
          affected += resu.matchedCount + resu.upsertedCount || 1;
        }
      }
    }

    res.status(200).json({ success: true, message: "Rates updated", data: { affected } });
  } catch (error) {
    console.error("Error bulkRates:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listRoomRates = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { dateFrom, dateTo, plan, overrideLevel } = req.query;
    const filter = { roomId };
    if (dateFrom) filter.date = { ...(filter.date || {}), $gte: parseISODate(dateFrom) };
    if (dateTo) filter.date = { ...(filter.date || {}), $lte: parseISODate(dateTo) };
    if (plan) filter.plan = plan;
    if (overrideLevel) filter.overrideLevel = overrideLevel;

    const rows = await RoomRate.find(filter).sort({ date: 1, plan: 1 });
    res.status(200).json({ success: true, data: rows.map((r) => ({ date: formatISODate(r.date), plan: r.plan, price: r.price, overrideLevel: r.overrideLevel })) });
  } catch (error) {
    console.error("Error listRoomRates:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const deleteRateOverride = async (req, res) => {
  try {
    const { roomId, date, plan } = req.params;
    const { overrideLevel = "override" } = req.query;
    const resu = await RoomRate.deleteOne({ roomId, date: parseISODate(date), plan, overrideLevel });
    if (resu.deletedCount === 0) return res.status(404).json({ success: false, message: "Rate override not found" });
    res.status(200).json({ success: true, message: "Rate override deleted" });
  } catch (error) {
    console.error("Error deleteRateOverride:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
