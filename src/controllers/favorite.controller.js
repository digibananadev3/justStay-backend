import mongoose from "mongoose";
import Favorite from "../models/favorite.model.js";
import PropertyInfo from "../models/property.model.js";

/**
 * 🟢 ADD PROPERTY TO FAVORITES
 * POST /api/favorites
 */
// Add property to favorites
export const addToFavorite = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { propertyId, notes, tags } = req.body;

    // Check property exists and not deleted
    const property = await PropertyInfo.findOne({
      _id: propertyId,
      isDeleted: false,
      // listingStatus: "approved" // optional safety
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not available",
      });
    }

    const favorite = await Favorite.create({
      userId,
      propertyId,
      notes,
      tags,
    });

    res.status(201).json({
      success: true,
      message: "Property added to favorites",
      data: favorite,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Property already in favorites",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

/**
 * 🔴 REMOVE PROPERTY FROM FAVORITES
 * DELETE /api/favorites/:propertyId
 */
export const removeFromFavorite = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { propertyId } = req.params;

    const deleted = await Favorite.findOneAndDelete({
      userId,
      propertyId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Favorite not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Property removed from favorites",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove favorite",
      error: error.message,
    });
  }
};

/**
 * 🟣 GET USER FAVORITES (UI READY)
 * GET /api/favorites
 */
export const getUserFavorites = async (req, res) => {
  try {
    const userId = req.user.userId;

    const favorites = await Favorite.find({ userId })
      .populate({
        path: "propertyId",
        match: { isDeleted: false }, // soft delete filter
      })
      .sort({ createdAt: -1 });

    // Remove favorites where property is null (deleted property)
    const filteredFavorites = favorites.filter(
      (fav) => fav.property !== null
    );

    res.json({
      success: true,
      count: filteredFavorites.length,
      data: filteredFavorites,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

/**
 * 🔍 CHECK IF PROPERTY IS FAVORITE
 * GET /api/favorites/check/:propertyId
 */
export const checkIsFavorite = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { propertyId } = req.params;

    const exists = await Favorite.exists({
      userId,
      propertyId,
    });

    return res.status(200).json({
      success: true,
      isFavorite: !!exists,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check favorite",
      error: error.message,
    });
  }
};