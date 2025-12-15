import mongoose from "mongoose";
import Settlement from "../models/settlement.model.js";

// GET /api/settlements
export const listSettlements = async (req, res) => {
  try {
    const { status, propertyId, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Settlement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Settlement.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    console.error("Error listSettlements:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/settlements/:id
export const getSettlementById = async (req, res) => {
  try {
    const { id } = req.params;
    const stl = await Settlement.findById(id);
    if (!stl) return res.status(404).json({ success: false, message: "Settlement not found" });
    res.status(200).json({ success: true, data: stl });
  } catch (error) {
    console.error("Error getSettlementById:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// POST /api/settlements/settle-now
export const settleNow = async (req, res) => {
  try {
    const { userId, propertyId, amount, method = "NEFT", notes } = req.body;
    if (typeof amount !== "number") return res.status(400).json({ success: false, message: "amount is required" });

    const stl = await Settlement.create({
      ...req.body,
      userId: userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : undefined,
      propertyId: propertyId && mongoose.Types.ObjectId.isValid(propertyId) ? new mongoose.Types.ObjectId(propertyId) : undefined,
      amount,
      method,
      settlementType: "manual",
      status: "processing",
      timeline: [{ status: "processing", note: notes }],
    });

    res.status(201).json({ success: true, message: "Settlement initiated", data: stl });
  } catch (error) {
    console.error("Error settleNow:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// POST /api/settlements/:id/status
export const updateSettlementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note, referenceId } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });

    const stl = await Settlement.findById(id);
    if (!stl) return res.status(404).json({ success: false, message: "Settlement not found" });

    stl.status = status;
    if (referenceId) stl.referenceId = referenceId;
    if (status === "paid") stl.paidAt = new Date();
    stl.timeline.push({ status, note, referenceId });
    await stl.save();

    res.status(200).json({ success: true, message: "Settlement status updated", data: { id: stl._id, status: stl.status } });
  } catch (error) {
    console.error("Error updateSettlementStatus:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
