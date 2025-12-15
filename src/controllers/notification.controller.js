import mongoose from "mongoose";
import Notification from "../models/notification.model.js";

// Create notification (internal use)
export const createNotification = async ({ userId, title, message, type = "system", category, link, meta }) => {
  return Notification.create({ userId, title, message, type, category, link, meta });
};

// POST /api/notifications (public create if needed)
export const createNotificationApi = async (req, res) => {
  try {
    const { userId, title, message, type, category, link, meta } = req.body;
    if (!userId || !title) return res.status(400).json({ success: false, message: "userId and title are required" });
    const n = await Notification.create({ userId, title, message, type, category, link, meta });
    res.status(201).json({ success: true, message: "Notification created", data: n });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/notifications
export const listNotifications = async (req, res) => {
  try {
    const { userId, type, isRead, isArchived, category, page = 1, limit = 20 } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    const filter = { userId };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (typeof isRead !== "undefined") filter.isRead = isRead === "true";
    if (typeof isArchived !== "undefined") filter.isArchived = isArchived === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/notifications/:id
export const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const n = await Notification.findById(id);
    if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
    res.status(200).json({ success: true, data: n });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// POST /api/notifications/:id/read
export const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const n = await Notification.findByIdAndUpdate(id, { $set: { isRead: true, readAt: new Date() } }, { new: true });
    if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
    res.status(200).json({ success: true, message: "Marked as read", data: n });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// POST /api/notifications/read-all
export const markAllRead = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    const resu = await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    res.status(200).json({ success: true, message: "All marked as read", data: { matched: resu.matchedCount ?? resu.n, modified: resu.modifiedCount ?? resu.nModified } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// POST /api/notifications/:id/archive
export const archiveNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const n = await Notification.findByIdAndUpdate(id, { $set: { isArchived: true } }, { new: true });
    if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
    res.status(200).json({ success: true, message: "Archived", data: n });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const resu = await Notification.findByIdAndDelete(id);
    if (!resu) return res.status(404).json({ success: false, message: "Notification not found" });
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
