import mongoose from "mongoose";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";

export const createReview = async (req, res) => {
  try {
    const { userId, propertyId, roomId, bookingId, rating, comment, images } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "User is required" });
    if (!propertyId) return res.status(400).json({ success: false, message: "propertyId is required" });
    if (!rating) return res.status(400).json({ success: false, message: "rating is required" });

    const review = await Review.create({
      userId,
      propertyId,
      roomId,
      bookingId,
      rating,
      comment,
      images: Array.isArray(images) ? images : [],
    });

    res.status(201).json({ success: true, message: "Review created", data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getReviews = async (req, res) => {
  try {
    const { propertyId, roomId, userId, bookingId, rating, isPublished, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (roomId && mongoose.Types.ObjectId.isValid(roomId)) filter.roomId = new mongoose.Types.ObjectId(roomId);
    if (userId && mongoose.Types.ObjectId.isValid(userId)) filter.userId = new mongoose.Types.ObjectId(userId);
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) filter.bookingId = new mongoose.Types.ObjectId(bookingId);
    if (rating) filter.rating = Number(rating);
    if (typeof isPublished !== "undefined") filter.isPublished = isPublished === "true";
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Review.find(filter)
        .populate("userId", "firstName lastName phone")
        .populate("propertyId", "basicPropertyDetails.name")
        .populate("roomId", "type")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments(filter),
    ]);

    
    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id)
      .populate("userId", "firstName lastName phone")
      .populate("propertyId", "basicPropertyDetails.name")
      .populate("roomId", "type");

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    res.status(200).json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user?._id;

    if (!message) return res.status(400).json({ success: false, message: "message is required" });

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    review.reply = { message, repliedBy: userId, repliedAt: new Date() };
    await review.save();

    res.status(200).json({ success: true, message: "Reply added", data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.body?.userId);

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    const isOwner = user && review.userId.toString() === user._id.toString();
    const isManager = user && (user.role === "admin" || user.role === "hotelier");

    if (!isOwner && !isManager) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await review.deleteOne();
    res.status(200).json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
