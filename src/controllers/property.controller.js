import PropertyInfo from "../models/property.model.js";
import mongoose from "mongoose";
// import { Parser } from "json2csv";
import { Parser } from "@json2csv/plainjs";

// -----------------------------
// Create Property (Hotelier)
// -----------------------------
export const createOrUpdateProperty = async (req, res) => {
  try {
    const userId = req.body.userId; // logged-in user (Hotelier)
    const propertyId = req.body.propertyId; // optional

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    let property;

    if (propertyId) {
      // Update existing property
      property = await PropertyInfo.findById(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }     

      Object.assign(property, req.body); // merge updates
      await property.save();
      return res.status(200).json({
        message: "Property updated successfully",
        property,
      });
    } else {
      // Create new property
      property = await PropertyInfo.create(req.body || {});

      return res.status(201).json({
        message: "Property created successfully",
        property,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Get All Properties
// -----------------------------
export const getAllProperties = async (req, res) => {
  try {
    const properties = await PropertyInfo.find().populate("userId", "firstName lastName email phone role");
    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Get Property by ID
// -----------------------------
export const getPropertyById = async (req, res) => {
  try {
   
    const property = await PropertyInfo.findById(req.params.id).populate("userId", "firstName lastName email phone role");
    if (!property) return res.status(404).json({ message: "Property not found" });

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Update Property (Hotelier/Admin)
// -----------------------------
export const updateProperty = async (req, res) => {
  try {
    const property = await PropertyInfo.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    // Optional: Only allow owner or admin to update
    if (property.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update this property" });
    }

    Object.assign(property, req.body); // merge updates
    await property.save();

    res.status(200).json({ message: "Property updated successfully", property });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Delete Property (Hotelier/Admin)
// -----------------------------
export const deleteProperty = async (req, res) => {
  try {
    const property = await PropertyInfo.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    // Optional: Only allow owner or admin to delete
    if (property.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this property" });
    }

    await property.remove();
    res.status(200).json({ message: "Property deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
