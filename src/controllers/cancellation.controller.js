import mongoose from "mongoose";
import Cancellation from "../models/cancellation.model.js";
import RoomBooking from "../models/roomBooking.model.js";

// POST /api/cancellations
export const initiateCancellation = async (req, res) => {
  try {
    const { bookingId, userId, propertyId, reason, policy, priceSummary, calculation } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: "bookingId is required" });
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    if (!propertyId) return res.status(400).json({ success: false, message: "propertyId is required" });

    const booking = await RoomBooking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const cancel = await Cancellation.create({
      bookingId: new mongoose.Types.ObjectId(bookingId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      userId: new mongoose.Types.ObjectId(userId),
      status: "Initiated",
      reason,
      policy,
      priceSummary: priceSummary || {},
      calculation: calculation || {},
      timeline: [{ action: "Initiated", by: new mongoose.Types.ObjectId(userId) }],
    });

    res.status(201).json({ success: true, message: "Cancellation initiated", data: cancel });
  } catch (error) {
    console.error("Error initiating cancellation:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/cancellations
export const listCancellations = async (req, res) => {
  try {
    const { bookingId, propertyId, userId, status, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) filter.bookingId = new mongoose.Types.ObjectId(bookingId);
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (userId && mongoose.Types.ObjectId.isValid(userId)) filter.userId = new mongoose.Types.ObjectId(userId);
    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Cancellation.find(filter)
        .populate("bookingId", "status priceSummary guestDetails stayDetails")
        .populate("userId", "firstName lastName phone")
        .populate("propertyId", "basicPropertyDetails.name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Cancellation.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    console.error("Error listing cancellations:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/cancellations/:id
export const getCancellationById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Cancellation.findById(id)
      .populate("bookingId", "status priceSummary guestDetails stayDetails")
      .populate("userId", "firstName lastName phone")
      .populate("propertyId", "basicPropertyDetails.name");
    if (!item) return res.status(404).json({ success: false, message: "Cancellation request not found" });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Error getting cancellation:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// POST /api/cancellations/:id/review
// body: { reviewerId, action: "approve"|"deny", cancellationFee?, refundableAmount?, notes? }
export const reviewCancellation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerId, action, cancellationFee, refundableAmount, notes } = req.body;
    if (!reviewerId) return res.status(400).json({ success: false, message: "reviewerId is required" });
    if (!action || !["approve", "deny"].includes(action)) return res.status(400).json({ success: false, message: "invalid action" });

    const cancel = await Cancellation.findById(id);
    if (!cancel) return res.status(404).json({ success: false, message: "Cancellation request not found" });

    if (action === "approve") {
      if (typeof cancellationFee === "number") cancel.calculation.cancellationFee = cancellationFee;
      if (typeof refundableAmount === "number") cancel.calculation.refundableAmount = refundableAmount;
      cancel.status = "Approved";
      cancel.timeline.push({ action: "Approved", by: new mongoose.Types.ObjectId(reviewerId), notes });
    } else {
      cancel.status = "Denied";
      cancel.timeline.push({ action: "Denied", by: new mongoose.Types.ObjectId(reviewerId), notes });
    }

    await cancel.save();
    res.status(200).json({ success: true, message: `Cancellation ${action}d`, data: cancel });
  } catch (error) {
    console.error("Error reviewing cancellation:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// POST /api/cancellations/:id/refund/initiate
// body: { operatorId, method, transactionId?, notes? }
export const initiateRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { operatorId, method = "Original", transactionId, notes } = req.body;
    if (!operatorId) return res.status(400).json({ success: false, message: "operatorId is required" });

    const cancel = await Cancellation.findById(id);
    if (!cancel) return res.status(404).json({ success: false, message: "Cancellation request not found" });
    if (!['Approved','RefundInProgress'].includes(cancel.status)) {
      return res.status(400).json({ success: false, message: "Refund can be initiated only after approval" });
    }

    cancel.payout.method = method;
    if (transactionId) cancel.payout.transactionId = transactionId;
    cancel.status = "RefundInProgress";
    cancel.timeline.push({ action: "RefundInProgress", by: new mongoose.Types.ObjectId(operatorId), notes, meta: { method, transactionId } });

    await cancel.save();
    res.status(200).json({ success: true, message: "Refund initiated", data: cancel });
  } catch (error) {
    console.error("Error initiating refund:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// POST /api/cancellations/:id/refund/complete
// body: { operatorId, transactionId? }
export const completeRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { operatorId, transactionId } = req.body;
    if (!operatorId) return res.status(400).json({ success: false, message: "operatorId is required" });

    const cancel = await Cancellation.findById(id);
    if (!cancel) return res.status(404).json({ success: false, message: "Cancellation request not found" });

    cancel.status = "Refunded";
    cancel.payout.paidAt = new Date();
    if (transactionId) cancel.payout.transactionId = transactionId;
    cancel.timeline.push({ action: "Refunded", by: new mongoose.Types.ObjectId(operatorId) });

    await cancel.save();
    res.status(200).json({ success: true, message: "Refund completed", data: cancel });
  } catch (error) {
    console.error("Error completing refund:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// PATCH /api/cancellations/:id/calc
// body: { cancellationFee?, refundableAmount? }
export const updateCalculation = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationFee, refundableAmount } = req.body;

    const updates = {};
    if (typeof cancellationFee === "number") updates["calculation.cancellationFee"] = cancellationFee;
    if (typeof refundableAmount === "number") updates["calculation.refundableAmount"] = refundableAmount;

    const updated = await Cancellation.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "Cancellation request not found" });
    res.status(200).json({ success: true, message: "Calculation updated", data: updated });
  } catch (error) {
    console.error("Error updating calculation:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
