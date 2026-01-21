// src/admin/controllers/properties.controller.js
import Property from "../../models/property.model.js";
import PropertyRoom from "../../models/propertyRoom.model.js";
import RoomBooking from "../../models/roomBooking.model.js";
import Review from "../../models/review.model.js";
import mongoose from "mongoose";
// import { Parser } from "json2csv";

import { Parser } from "@json2csv/plainjs";

import {
  calculatePropertyRatings,
  getPropertyRoomCounts,
  getPropertiesByAmenities,
} from "../../utils/propertyUtils.js";

// Dummy data for fallback
const dummyProperties = []; // Add your dummy properties array here if needed

// Helper function to handle errors
const handleError = (res, error, message = "Server error") => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
};

// -------- REVIEWS (Admin) --------
// Summary cards + recent reviews
export const getPropertyReviewsSummary = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Ensure property exists
    const property = await Property.findById(propertyId).select("_id");
    if (!property)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });

    const [totals, recent] = await Promise.all([
      Review.aggregate([
        {
          $match: {
            propertyId: new mongoose.Types.ObjectId(propertyId),
            isPublished: true,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            avgRating: { $avg: "$rating" },
            replied: {
              $sum: { $cond: [{ $ifNull: ["$reply.message", false] }, 1, 0] },
            },
          },
        },
      ]),
      Review.find({ propertyId, isPublished: true })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("userId rating comment createdAt reply")
        .populate("userId", "firstName lastName")
        .lean(),
    ]);

    const total = totals?.[0]?.total || 0;
    const avgRating = totals?.[0]?.avgRating
      ? Math.round(totals[0].avgRating * 10) / 10
      : 0;
    const replied = totals?.[0]?.replied || 0;
    const responseRate = total > 0 ? Math.round((replied / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        cards: { totalReviews: total, averageRating: avgRating, responseRate },
        recentReviews: recent,
      },
    });
  } catch (error) {
    console.error("Error in getPropertyReviewsSummary:", error);
    return handleError(res, error, "Error fetching reviews summary");
  }
};

// List reviews (paginated)
export const getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { page = 1, limit = 10, isPublished } = req.query;
    const query = { propertyId };
    if (isPublished === "true" || isPublished === "false")
      query.isPublished = isPublished === "true";

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select("userId rating comment createdAt reply isPublished")
        .populate("userId", "firstName lastName")
        .lean(),
      Review.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error in getPropertyReviews:", error);
    return handleError(res, error, "Error fetching reviews");
  }
};

// Reply to a review
export const replyToReview = async (req, res) => {
  try {
    const { propertyId, reviewId } = req.params;
    const { message, repliedBy } = req.body; // repliedBy optional (admin userId)
    if (!message)
      return res
        .status(400)
        .json({ success: false, message: "message is required" });

    const review = await Review.findOne({ _id: reviewId, propertyId });
    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });

    review.reply = { message, repliedBy, repliedAt: new Date() };
    await review.save();

    return res.status(200).json({ success: true, data: review });
  } catch (error) {
    console.error("Error in replyToReview:", error);
    return handleError(res, error, "Error replying to review");
  }
};

// Publish/unpublish a review
export const updateReviewPublishStatus = async (req, res) => {
  try {
    const { propertyId, reviewId } = req.params;
    const { isPublished } = req.body;
    const updated = await Review.findOneAndUpdate(
      { _id: reviewId, propertyId },
      { $set: { isPublished: !!isPublished } },
      { new: true }
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in updateReviewPublishStatus:", error);
    return handleError(res, error, "Error updating review");
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    const { propertyId, reviewId } = req.params;
    const deleted = await Review.findOneAndDelete({
      _id: reviewId,
      propertyId,
    });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    return res
      .status(200)
      .json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error in deleteReview:", error);
    return handleError(res, error, "Error deleting review");
  }
};

// -------- PERFORMANCE (Admin) --------
export const getPropertyPerformance = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Ensure property exists
    const property = await Property.findById(propertyId).select("_id");
    if (!property)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    // Aggregations in parallel
    const [totalBookings, revenueAgg, thisMonthAgg, lastMonthAgg, totalRooms] =
      await Promise.all([
        RoomBooking.countDocuments({ propertyId }),
        RoomBooking.aggregate([
          { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $ifNull: ["$priceSummary.totalAmount", 0] } },
            },
          },
        ]),
        RoomBooking.countDocuments({
          propertyId,
          createdAt: { $gte: startOfThisMonth, $lte: now },
        }),
        RoomBooking.countDocuments({
          propertyId,
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),
        PropertyRoom.countDocuments({ propertyId }),
      ]);

    // Occupancy: rooms with active stays now
    const occupiedNow = await RoomBooking.distinct("_id", {
      propertyId,
      status: { $in: ["Booked", "CheckIn"] },
      "stayDetails.checkInDate": { $lte: now },
      "stayDetails.expectedCheckOutDate": { $gte: now },
    });
    const occupancy =
      totalRooms > 0
        ? Math.round((occupiedNow.length / totalRooms) * 10000) / 100
        : 0;

    // Rating via utility (if available)
    let avgRating = 0;
    try {
      const ratingsMap = await calculatePropertyRatings([propertyId]);
      avgRating = ratingsMap[propertyId]?.rating || 0;
    } catch (e) {
      avgRating = 0;
    }

    const revenue = revenueAgg?.[0]?.revenue || 0;

    return res.status(200).json({
      success: true,
      data: {
        cards: {
          totalBookings,
          revenue,
          avgRating: Math.round(avgRating * 10) / 10,
          occupancy,
        },
        trends: {
          thisMonth: thisMonthAgg,
          lastMonth: lastMonthAgg,
        },
      },
    });
  } catch (error) {
    console.error("Error in getPropertyPerformance:", error);
    return handleError(res, error, "Error fetching performance");
  }
};

// -------- DOCUMENTS (Admin) --------
// Summary for documents
export const getPropertyDocumentsSummary = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findById(propertyId)
      .select("documents")
      .lean();
    if (!property)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });

    const docs = Array.isArray(property.documents) ? property.documents : [];
    const total = docs.length;
    const verified = docs.filter((d) => d.status === "Verified").length;
    const pending = docs.filter((d) => d.status === "Pending").length;
    const rejected = docs.filter((d) => d.status === "Rejected").length;

    res
      .status(200)
      .json({ success: true, data: { total, verified, pending, rejected } });
  } catch (error) {
    console.error("Error in getPropertyDocumentsSummary:", error);
    return handleError(res, error, "Error getting documents summary");
  }
};

// Get documents list
export const getPropertyDocuments = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findById(propertyId)
      .select("documents")
      .lean();
    if (!property)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, data: property.documents || [] });
  } catch (error) {
    console.error("Error in getPropertyDocuments:", error);
    return handleError(res, error, "Error fetching documents");
  }
};

// Add documents (array)
export const addPropertyDocuments = async (req, res) => {
  try {
    console.log("Coming to the add Property Document");
    const { propertyId } = req.params;
    const { documents = [] } = req.body;
    console.log("This is the value of the propertyId", req.params);
    console.log("This is the value of the documents", documents);
    if (!Array.isArray(documents) || documents.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "documents array is required" });
    }

    const docs = documents.map((d) => ({
      name: d.name,
      documentType: d.documentType,
      documentUrl: d.documentUrl,
      status: d.status || "Pending",
      expiresAt: d.expiresAt,
    }));

    console.log("This is the value of the docs of the add property document", docs);

    const updated = await Property.findByIdAndUpdate(
      propertyId,
      { $push: { documents: { $each: docs } } },
      { new: true, runValidators: true }
    ).select("documents");

    console.log("This is the value of the updated of the add property document", updated);

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, data: updated.documents });
  } catch (error) {
    console.error("Error in addPropertyDocuments:", error);
    return handleError(res, error, "Error adding documents");
  }
};

// Update a single document by documentId
export const updatePropertyDocument = async (req, res) => {
  try {
    const { propertyId, documentId } = req.params;
    const { name, documentType, documentUrl, status, expiresAt, remark } = req.body;


    // console.log("This is the value of the body of the updatePropertyDocument", req.body);

    const property = await Property.findById(propertyId);
    if (!property)
      return res.status(404).json({ success: false, message: "Property not found" });

    const doc = property.documents.id(documentId);

    // console.log("This is the value of the doc of the updatePropertyDocument", doc);
    if (!doc)
      return res.status(404).json({ success: false, message: "Document not found" });


    if (name !== undefined) doc.name = name;
    if (documentType !== undefined) doc.documentType = documentType;
    if (documentUrl !== undefined) doc.documentUrl = documentUrl;
    // if (status !== undefined) doc.status = status;
    if (expiresAt !== undefined) doc.expiresAt = expiresAt;

    if (status !== undefined) {

      // Pending → clear remark
      if (status === "Pending") {
        doc.status = "Pending";
        doc.remark = "";
      }

      // Verified or Rejected → require remark
      if (status === "Verified" || status === "Rejected") {
        if (!remark || remark.trim() === "") {
          return res.status(400).json({
            success: false,
            message: `Remark is required when status is ${status}`
          });
        }

        doc.status = status;
        doc.remark = remark;
      }
    }

    
     // Allow updating remark ONLY if document already Verified or Rejected
    if (
      remark !== undefined &&
      (doc.status === "Verified" || doc.status === "Rejected")
    ) {
      doc.remark = remark.trim();
    }

    await property.save();
    res.status(200).json({ success: true, data: property.documents, message: "Document updated successfully" });
  } catch (error) {
    console.error("Error in updatePropertyDocument:", error);
    return handleError(res, error, "Error updating document");
  }
};

// Bulk update document statuses
export const updatePropertyDocumentStatuses = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { documents } = req.body; // [{documentId, status}]
    if (!Array.isArray(documents) || documents.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "documents array is required" });
    }

    const property = await Property.findById(propertyId).select("documents");
    if (!property)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });

    const map = new Map(documents.map((u) => [String(u.documentId), u.status]));
    property.documents = property.documents.map((d) => {
      const id = String(d._id);
      if (map.has(id)) d.status = map.get(id);
      return d;
    });
    await property.save();

    res.status(200).json({ success: true, data: property.documents });
  } catch (error) {
    console.error("Error in updatePropertyDocumentStatuses:", error);
    return handleError(res, error, "Error updating document statuses");
  }
};

// Delete a single document
export const deletePropertyDocument = async (req, res) => {
  try {
    const { propertyId, documentId } = req.params;
    const updated = await Property.findByIdAndUpdate(
      propertyId,
      { $pull: { documents: { _id: documentId } } },
      { new: true }
    ).select("documents");
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, data: updated.documents });
  } catch (error) {
    console.error("Error in deletePropertyDocument:", error);
    return handleError(res, error, "Error deleting document");
  }
};

// -------- MEDIA (Admin) --------
// Media summary cards for a property
export const getPropertyMediaSummary = async (req, res) => {
  try {
    const { propertyId } = req.params;
    // const property = await Property.findById(propertyId)
    const property = await Property.findOne({ _id: propertyId, isDeleted: false })
      .select("photos videos")
      .lean();
    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    const photos = Array.isArray(property.photos) ? property.photos : [];
    const totalImages = photos.length;
    const approved = photos.filter((p) => p.status === "Approved").length;
    const pending = photos.filter((p) => p.status !== "Approved").length;

    res.status(200).json({
      success: true,
      data: {
        totalImages,
        approved,
        pending,
        minimumRequired: 15,
      },
    });
  } catch (error) {
    console.error("Error in getPropertyMediaSummary:", error);
    return handleError(res, error, "Error getting media summary");
  }
};

// Add photos (array of {name,url})
export const addPropertyMediaPhotos = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { photos = [] } = req.body;

    console.log("This is the photos of the addPropertyMediaPhotos", photos, req.body);
    if (!Array.isArray(photos) || photos.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "photos array is required" });
    }

    // Normalize to include status
    const docs = photos.map((p) => ({
      name: p.name,
      url: p.url,
      status: p.status || "Pending",
    }));

    const updated = await Property.findByIdAndUpdate(
      propertyId,
      { $push: { photos: { $each: docs } } },
      { new: true, runValidators: true }
    ).select("photos");

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    res.status(200).json({ success: true, data: updated.photos });
  } catch (error) {
    console.error("Error in addPropertyMediaPhotos:", error);
    return handleError(res, error, "Error adding photos");
  }
};

// Update photo status (bulk by subdoc _id)
export const updatePropertyPhotoStatuses = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { photos } = req.body; // [{photoId, status}]
    if (!Array.isArray(photos) || photos.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "photos array is required" });
    }

    const property = await Property.findById(propertyId).select("photos");
    if (!property)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });

    const map = new Map(photos.map((u) => [String(u.photoId), u.status]));
    property.photos = property.photos.map((p) => {
      const id = String(p._id);
      if (map.has(id)) {
        p.status = map.get(id);
      }
      return p;
    });
    await property.save();

    res.status(200).json({ success: true, data: property.photos });
  } catch (error) {
    console.error("Error in updatePropertyPhotoStatuses:", error);
    return handleError(res, error, "Error updating photo statuses");
  }
};

// Delete a single photo by photoId
export const deletePropertyMediaPhoto = async (req, res) => {
  try {
    const { propertyId, photoId } = req.params;
    const updated = await Property.findByIdAndUpdate(
      propertyId,
      { $pull: { photos: { _id: photoId } } },
      { new: true }
    ).select("photos");

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, data: updated.photos });
  } catch (error) {
    console.error("Error in deletePropertyMediaPhoto:", error);
    return handleError(res, error, "Error deleting photo");
  }
};

// List videos
export const getPropertyVideos = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findById(propertyId)
      .select("videos")
      .lean();
    if (!property)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, data: property.videos || [] });
  } catch (error) {
    console.error("Error in getPropertyVideos:", error);
    return handleError(res, error, "Error fetching videos");
  }
};

// Add videos (array of {title,url,thumbnail})
export const addPropertyVideos = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { videos = [] } = req.body;
    if (!Array.isArray(videos) || videos.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "videos array is required" });
    }
    const docs = videos.map((v) => ({
      title: v.title,
      url: v.url,
      thumbnail: v.thumbnail,
      status: v.status || "Pending",
    }));
    const updated = await Property.findByIdAndUpdate(
      propertyId,
      { $push: { videos: { $each: docs } } },
      { new: true, runValidators: true }
    ).select("videos");
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, data: updated.videos });
  } catch (error) {
    console.error("Error in addPropertyVideos:", error);
    return handleError(res, error, "Error adding videos");
  }
};

// Delete a single video by videoId
export const deletePropertyVideo = async (req, res) => {
  try {
    const { propertyId, videoId } = req.params;
    const updated = await Property.findByIdAndUpdate(
      propertyId,
      { $pull: { videos: { _id: videoId } } },
      { new: true }
    ).select("videos");
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    res.status(200).json({ success: true, data: updated.videos });
  } catch (error) {
    console.error("Error in deletePropertyVideo:", error);
    return handleError(res, error, "Error deleting video");
  }
};

// Get all properties with filters
export const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      city,
      status,
      propertyType,
      minRating,
      isFeatured,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // const query = {};
    const query = { isDeleted: false };

    // Build query
    if (search) {
      const orConditions = [
        { "basicPropertyDetails.name": { $regex: search, $options: "i" } },
        { "contactDetails.email": { $regex: search, $options: "i" } },
        { "contactDetails.mobile": { $regex: String(search), $options: "i" } },
      ];

      // If search is a valid Mongo ObjectId, include it
      if (mongoose.Types.ObjectId.isValid(search)) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      query.$or = orConditions;
    }
    if (city) {
      query["location.city"] = new RegExp(city, "i");
    }
    if (status) {
      query.status = status;
    }
    if (propertyType) {
      query.propertyType = propertyType;
    }
    if (isFeatured === "true") {
      query.isFeatured = true;
    }

    // Get properties with pagination
    const skip = (page - 1) * limit;
    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "firstName lastName email phone")
        .lean(),
      Property.countDocuments(query),
    ]);

    // If no properties found, use dummy data
    if (properties.length === 0) {
      console.log("Using dummy properties data");
      // ... (keep your existing dummy data fallback)
    }

    // Get additional data
    const propertyIds = properties.map((p) => p._id);
    const [roomCounts, propertyRatings] = await Promise.all([
      getPropertyRoomCounts(propertyIds),
      calculatePropertyRatings(propertyIds),
    ]);

    // Filter by minimum rating if specified
    let filteredProperties = properties;
    if (minRating) {
      const minRatingNum = parseFloat(minRating);
      filteredProperties = properties.filter((property) => {
        const rating = propertyRatings[property._id.toString()]?.rating || 0;
        return rating >= minRatingNum;
      });
    }

    // Enhance properties with additional data
    const enhancedProperties = filteredProperties.map((property) => {
      const propertyId = property._id.toString();
      return {
        ...property,
        roomCount: roomCounts[propertyId] || 0,
        rating: propertyRatings[propertyId]?.rating || 0,
        totalRatings: propertyRatings[propertyId]?.totalRatings || 0,
      };
    });


    res.status(200).json({
      success: true,
      data: enhancedProperties,
      pagination: {
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getAllProperties:", error);
    return handleError(res, error, "Error fetching properties");
  }
};


// Export all properties
export const exportProperties = async (req, res) => {

  try {
    const {
      search,
      city,
      status,
      propertyType,
      minRating,
      isFeatured,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // const query = {};
    const query = { isDeleted: false };


    if (search) {
      const orConditions = [
        { "basicPropertyDetails.name": { $regex: search, $options: "i" } },
        { "contactDetails.email": { $regex: search, $options: "i" } },
        { "contactDetails.mobile": { $regex: String(search), $options: "i" } },
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      query.$or = orConditions;
    }

    if (city) query["location.city"] = new RegExp(city, "i");
    if (status) query.status = status;
    if (propertyType) query.propertyType = propertyType;
    if (isFeatured === "true") query.isFeatured = true;

    const properties = await Property.find(query)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .populate("userId", "firstName lastName email phone")
      .lean();

    const propertyIds = properties.map((p) => p._id);

    let roomCounts = {};
    let propertyRatings = {};

    if (propertyIds.length) {
      [roomCounts, propertyRatings] = await Promise.all([
        getPropertyRoomCounts(propertyIds),
        calculatePropertyRatings(propertyIds),
      ]);
    }

    let finalData = properties.map((property) => {
      const id = property._id.toString();
      return {
        PropertyID: id,
        Name: property.basicPropertyDetails?.name || "",
        City: property.location?.city || "",
        OwnerName: `${property.userId?.firstName || ""} ${property.userId?.lastName || ""}`,
        OwnerEmail: property.userId?.email || "",
        OwnerPhone: property.userId?.phone || "",
        Rooms: roomCounts[id] || 0,
        Rating: propertyRatings[id]?.rating || 0,
        Status: property.status,
        Featured: property.isFeatured ? "Yes" : "No",
        CreatedAt: property.createdAt,
      };
    });

    if (minRating) {
      const min = parseFloat(minRating);
      finalData = finalData.filter((p) => p.Rating >= min);
    }

    const fields = Object.keys(finalData[0] || {});
    const parser = new Parser({ fields });
    const csv = parser.parse(finalData);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=properties_export.csv"
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Export error:", error);
    return res.status(500).json({
      success: false,
      message: "Export failed",
    });
  }
};


// Update property by ID
export const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate Mongo ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const {
      name,
      city,
      state,
      phone,
      status,
      propertyType,
      // isFeatured,
    } = req.body;

    // Build update object safely
    const updateData = {};

    if (name !== undefined)
      updateData["basicPropertyDetails.name"] = name;

    if (city !== undefined)
      updateData["location.city"] = city;

    if (state !== undefined)
      updateData["location.state"] = state;

    if (phone !== undefined)
      updateData["contactDetails.mobile"] = phone;

    if (status !== undefined)
      updateData.status = status;

    if (propertyType !== undefined)
      updateData.propertyType = propertyType;

    // Prevent empty update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    // Update property
    const updatedProperty = await Property.findByIdAndUpdate(
      id,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("userId", "firstName lastName email phone")
      .lean();

    if (!updatedProperty) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Property updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Error in updateProperty:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property",
    });
  }
};

// Delete property by ID


export const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // ---- SOFT DELETE ----
    property.isDeleted = true;
    property.deletedAt = new Date();
    await property.save();

    return res.status(200).json({
      success: true,
      message: "Property deleted successfully (soft delete)",
    });

  } catch (error) {
    console.error("Error in deleteProperty:", error);
    return handleError(res, error, "Failed to delete property");
  }
};



// Add amenities to a property
export const addPropertyAmenities = async (req, res) => {
  try {
    console.log("Welcome to the add property amenties controller");
    const { propertyId } = req.params;
    const { amenities } = req.body;

    // Validate propertyId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    // Validate amenities
    if (!Array.isArray(amenities) || amenities.length === 0) {
      return res.status(400).json({
        success: false,
        message: "amenities must be a non-empty array",
      });
    }

    // Normalize amenities (trim + remove empty)
    const normalizedAmenities = amenities
      .map((a) => String(a).trim())
      .filter(Boolean);

    if (normalizedAmenities.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amenities provided",
      });
    }

    // Update property (avoid duplicates)
    const property = await Property.findByIdAndUpdate(
      propertyId,
      {
        $addToSet: {
          propertyAmenities: { $each: normalizedAmenities },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("propertyAmenities");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Amenities added successfully",
      data: property.propertyAmenities,
    });
  } catch (error) {
    console.error("Error in addPropertyAmenities:", error);
    return handleError(res, error, "Error adding amenities");
  }
};


// Remove amenities from a property
export const removePropertyAmenities = async (req, res) => {
  try {
    console.log("Welcome to remove property amenities controller");

    const { propertyId } = req.params;
    const { amenities } = req.body; // array of amenity names

    // Validate propertyId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    // Validate amenities
    if (!Array.isArray(amenities) || amenities.length === 0) {
      return res.status(400).json({
        success: false,
        message: "amenities must be a non-empty array",
      });
    }

    // Normalize amenities (trim + remove empty)
    const normalizedAmenities = amenities
      .map((a) => String(a).trim())
      .filter(Boolean);

    if (normalizedAmenities.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amenities provided",
      });
    }

    // Remove amenities
    const property = await Property.findByIdAndUpdate(
      propertyId,
      {
        $pull: {
          propertyAmenities: { $in: normalizedAmenities },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("propertyAmenities");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Amenities removed successfully",
      data: property.propertyAmenities,
    });
  } catch (error) {
    console.error("Error in removePropertyAmenities:", error);
    return handleError(res, error, "Error removing amenities");
  }
};


// Get featured properties
export const getFeaturedProperties = async (req, res) => {
  try {
    const { limit = 4, amenities } = req.query;

    // Get featured properties
    let featured;
    if (amenities) {
      featured = await getPropertiesByAmenities(amenities, parseInt(limit));
    } else {
      featured = await Property.find({ isFeatured: true, isDeleted: false })
        .limit(parseInt(limit))
        .populate("userId", "firstName lastName")
        .lean();
    }

    // Fallback to dummy data if no featured properties found
    if (!featured || featured.length === 0) {
      featured = dummyProperties
        .filter((p) => p.isFeatured)
        .slice(0, parseInt(limit));
    }

    // Get additional data
    const propertyIds = featured.map((p) => p._id);
    const [roomCounts, propertyRatings] = await Promise.all([
      getPropertyRoomCounts(propertyIds),
      calculatePropertyRatings(propertyIds),
    ]);

    // Enhance properties with additional data
    const enhancedProperties = featured.map((property) => {
      const propertyId = property._id.toString();
      return {
        ...property,
        roomCount: roomCounts[propertyId] || 0,
        rating: propertyRatings[propertyId]?.rating || 0,
        totalRatings: propertyRatings[propertyId]?.totalRatings || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: enhancedProperties,
    });
  } catch (error) {
    console.error("Error in getFeaturedProperties:", error);
    return handleError(res, error, "Error fetching featured properties");
  }
};

// Get property statistics
export const getPropertyStats = async (req, res) => {
  try {
    const [
      totalProperties,
      propertiesByStatus,
      propertiesByType,
      propertiesByCity,
      recentProperties,
    ] = await Promise.all([
      // Total properties count
      // Property.countDocuments(),
            Property.countDocuments({ isDeleted: false }),

      // Properties grouped by status
      // Property.aggregate([
      //   { $group: { _id: "$status", count: { $sum: 1 } } },
      //   { $sort: { count: -1 } },
      // ]),

        Property.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Properties grouped by type
      Property.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$propertyType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Properties grouped by city (top 5)
      Property.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$location.city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Recent properties
      Property.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("basicPropertyDetails.name location.city status createdAt")
        .populate("userId", "firstName lastName")
        .lean(),
    ]);

    // Get room counts and ratings for recent properties
    const recentPropertyIds = recentProperties.map((p) => p._id);
    const [roomCounts, propertyRatings] = await Promise.all([
      getPropertyRoomCounts(recentPropertyIds),
      calculatePropertyRatings(recentPropertyIds),
    ]);

    // Enhance recent properties with room counts and ratings
    const enhancedRecentProperties = recentProperties.map((property) => {
      const propertyId = property._id.toString();
      return {
        ...property,
        roomCount: roomCounts[propertyId] || 0,
        rating: propertyRatings[propertyId]?.rating || 0,
        totalRatings: propertyRatings[propertyId]?.totalRatings || 0,
      };
    });

    // Prepare statistics object
    const stats = {
      totalProperties,
      propertiesByStatus,
      propertiesByType,
      propertiesByCity,
      recentProperties: enhancedRecentProperties,
    };

    // Fallback to dummy data if no stats found
    if (totalProperties === 0) {
      console.log("Using dummy statistics data");
      // Add dummy data fallback here if needed
    }

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error in getPropertyStats:", error);
    return handleError(res, error, "Error fetching property statistics");
  }
};

// Get property by id
export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    // const property = await Property.findById(id).populate(
    //   "userId",
    //   "firstName lastName"
    // );

        const property = await Property.findOne({ _id: id, isDeleted: false }).populate(
      "userId",
      "firstName lastName"
    );
    
    const propertyRoom = await PropertyRoom.find({ propertyId: id });
    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }
    res.status(200).json({ success: true, data: { property, propertyRoom } });
  } catch (error) {
    console.error("Error in getPropertyById:", error);
    return handleError(res, error, "Error fetching property by ID");
  }
};

// Get all room details for a specific property
export const getPropertyRooms = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      type,
      minPrice,
      maxPrice,
      amenities,
      sortBy = "price.oneNight",
      sortOrder = "asc",
    } = req.query;

    // Build query
    const query = { propertyId };

    // Add filters
    if (type) {
      query.type = { $in: Array.isArray(type) ? type : [type] };
    }

    if (minPrice || maxPrice) {
      query["price.oneNight"] = {};
      if (minPrice) query["price.oneNight"].$gte = Number(minPrice);
      if (maxPrice) query["price.oneNight"].$lte = Number(maxPrice);
    }

    if (amenities) {
      const amenitiesList = Array.isArray(amenities) ? amenities : [amenities];
      query.amenities = { $all: amenitiesList };
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Fetch rooms with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      PropertyRoom.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-__v")
        .lean(),
      PropertyRoom.countDocuments(query),
    ]);

    // Get unique room types and amenities for filters
    const [roomTypes, allAmenities] = await Promise.all([
      PropertyRoom.distinct("type", { propertyId }),
      PropertyRoom.distinct("amenities", { propertyId }),
    ]);

    // Get price range for all rooms
    const priceStats = await PropertyRoom.aggregate([
      { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$price.oneNight" },
          maxPrice: { $max: "$price.oneNight" },
          avgPrice: { $avg: "$price.oneNight" },
        },
      },
    ]);

    // ----- NEW: totalRoom and occupancyRate -----
    // totalRoom: total rooms for the property (ignores filters)
    const totalRoom = await PropertyRoom.countDocuments({ propertyId });

    // occupancyRate: percentage of rooms currently occupied.
    // Assumes a Booking model exists. Adjust model/fields if different.
    let occupancyRate = 0;
    try {
      const now = new Date();

      // Find distinct roomIds that are currently occupied.
      // Adjust status values if you use different naming.
      const occupiedRoomIds = await Booking.distinct("roomId", {
        propertyId,
        status: { $in: ["BOOKED", "CHECKED_IN"] },
        checkIn: { $lte: now },
        checkOut: { $gte: now },
      });

      const occupiedRoomsCount = occupiedRoomIds.length;

      occupancyRate =
        totalRoom > 0
          ? Math.round((occupiedRoomsCount / totalRoom) * 100 * 100) / 100 // two decimals
          : 0;
    } catch (bookErr) {
      // If Booking model doesn't exist or query fails, keep occupancyRate = 0
      console.warn("Could not calculate occupancy rate:", bookErr);
      occupancyRate = 0;
    }
    // --------------------------------------------

    // Format response
    const response = {
      success: true,
      data: {
        rooms,
        totalRoom, // <-- added
        occupancyRate, // <-- added (percentage)
        filters: {
          roomTypes,
          amenities: [...new Set(allAmenities.flat())].filter(Boolean).sort(),
          priceRange:
            priceStats.length > 0
              ? {
                  min: priceStats[0].minPrice,
                  max: priceStats[0].maxPrice,
                  avg: Math.round(priceStats[0].avgPrice * 100) / 100,
                }
              : { min: 0, max: 0, avg: 0 },
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in getPropertyRooms:", error);
    return handleError(res, error, "Error fetching property rooms");
  }
};

// Get all photos for a property
export const getPropertyPhotos = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId)
      .select("photos")
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        propertyId,
        photos: property.photos || [],
      },
    });
  } catch (error) {
    console.error("Error in getPropertyPhotos:", error);
    return handleError(res, error, "Error fetching property photos");
  }
};
