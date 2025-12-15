import mongoose from "mongoose";
import User from "../models/user.model.js";
import PropertyInfo from "../models/property.model.js";
import PropertyRoom from "../models/propertyRoom.model.js";
import Review from "../models/review.model.js";
import SupportTicket from "../models/supportTicket.model.js";
import RoomBooking from "../models/roomBooking.model.js";

// GET /api/profile?userId=
export const getProfile = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const property = await PropertyInfo.findOne({ userId: user?._id });

    res.status(200).json({ success: true, data: { user, property } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// PUT /api/profile  body: { userId, firstName?, lastName?, phone?, email?, avatar? }
export const updateUserProfile = async (req, res) => {
  try {
    const { userId, firstName, lastName, phone, email, avatar } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const update = {};
    if (typeof firstName !== "undefined") update.firstName = firstName;
    if (typeof lastName !== "undefined") update.lastName = lastName;
    if (typeof phone !== "undefined") update.phone = phone;
    if (typeof email !== "undefined") update.email = email;
    if (typeof avatar !== "undefined") update.avatar = avatar;

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true }).select(
      "firstName lastName phone email avatar role"
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, message: "Profile updated", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// PUT /api/profile/property/:id
// body: { name?, phone?, email?, logo? }
export const updatePropertyCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, logo } = req.body;

    const set = {};
    if (typeof name !== "undefined") set["basicPropertyDetails.name"] = name;
    if (typeof phone !== "undefined") set["contact.phone"] = phone;
    if (typeof email !== "undefined") set["contact.email"] = email;
    if (typeof logo !== "undefined") set["photos.logo"] = logo;

    const property = await PropertyInfo.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).select(
      "basicPropertyDetails.name contact.phone contact.email photos.logo"
    );
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, message: "Property updated", data: property });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/profile/summary?userId=
export const getProfileSummary = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const property = await PropertyInfo.findOne({ userId });
    const propertyId = property?._id;

    const [bookings, rooms, reviews, tickets] = await Promise.all([
      RoomBooking.countDocuments(propertyId ? { propertyId } : {}),
      PropertyRoom.countDocuments(propertyId ? { propertyId } : {}),
      Review.countDocuments(propertyId ? { propertyId } : {}),
      SupportTicket.countDocuments(propertyId ? { createdBy: userId } : { createdBy: userId }),
    ]);

    res.status(200).json({ success: true, data: { bookings, rooms, reviews, supportTickets: tickets } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
