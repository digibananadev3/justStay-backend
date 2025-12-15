import mongoose from "mongoose";
import Promotion from "../models/promotion.model.js";
import SeasonalEvent from "../models/seasonalEvent.model.js";

const parseDate = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : undefined);

// Promotions
export const createPromotion = async (req, res) => {
  try {
    const body = req.body;
    if (!body.title || !body.startDate || !body.endDate) {
      return res.status(400).json({ success: false, message: "title, startDate, endDate are required" });
    }
    const data = await Promotion.create(body);
    res.status(201).json({ success: true, message: "Promotion created", data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listPromotions = async (req, res) => {
  try {
    const { propertyId, status, q, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (status) filter.status = status;
    if (q) filter.title = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Promotion.find(filter).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(Number(limit)),
      Promotion.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getPromotionById = async (req, res) => {
  try {
    const item = await Promotion.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Promotion not found" });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updatePromotion = async (req, res) => {
  try {
    const item = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: "Promotion not found" });
    res.status(200).json({ success: true, message: "Promotion updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const item = await Promotion.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Promotion not found" });
    res.status(200).json({ success: true, message: "Promotion deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getDashboardPromotions = async (req, res) => {
  try {
    const { propertyId } = req.query;
    const today = new Date();
    const filter = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);

    const [active, scheduled, expired] = await Promise.all([
      Promotion.find({ ...filter, status: "Active" }).sort({ priority: -1 }),
      Promotion.find({ ...filter, status: "Scheduled" }).sort({ startDate: 1 }),
      Promotion.find({ ...filter, status: "Expired" }).sort({ endDate: -1 }),
    ]);

    // Seasonal events
    const seasonal = await SeasonalEvent.find({ ...filter, status: { $in: ["Active", "Scheduled"] } }).sort({ priority: -1, startDate: 1 });

    res.status(200).json({ success: true, data: { active, scheduled, expired, seasonal } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Seasonal Events
export const createSeasonalEvent = async (req, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.startDate || !body.endDate || typeof body.multiplier !== "number")
      return res.status(400).json({ success: false, message: "name, startDate, endDate, multiplier are required" });
    const data = await SeasonalEvent.create(body);
    res.status(201).json({ success: true, message: "Seasonal event created", data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listSeasonalEvents = async (req, res) => {
  try {
    const { propertyId, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (status) filter.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      SeasonalEvent.find(filter).sort({ priority: -1, startDate: 1 }).skip(skip).limit(Number(limit)),
      SeasonalEvent.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateSeasonalEvent = async (req, res) => {
  try {
    const item = await SeasonalEvent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: "Seasonal event not found" });
    res.status(200).json({ success: true, message: "Seasonal event updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const deleteSeasonalEvent = async (req, res) => {
  try {
    const item = await SeasonalEvent.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Seasonal event not found" });
    res.status(200).json({ success: true, message: "Seasonal event deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
