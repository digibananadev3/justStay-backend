import mongoose from "mongoose";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";
import { updatePropertyRating } from "./property.controller.js";

export const createReview = async (req, res) => {
  try {
    const { userId, propertyId, roomId, bookingId, ratings, comment, images } =
      req.body;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "User is required" });
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId is required" });
    if (!ratings)
      return res
        .status(400)
        .json({ success: false, message: "ratings is required" });

    const userExists = await User.exists({ _id: userId });
    if (!userExists)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const propertyExists = await mongoose
      .model("PropertyInfo")
      .exists({ _id: propertyId });
    if (!propertyExists)
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });

    const bookingExists = bookingId
      ? await mongoose.model("RoomBooking").exists({ _id: bookingId })
      : true;
    if (!bookingExists)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    const { cleanliness, location, staffBehaviour, valueForMoney } = ratings;

    // Validate each rating
    if (
      [cleanliness, location, staffBehaviour, valueForMoney].some(
        (r) => typeof r !== "number" || r < 1 || r > 5,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Each rating must be a number between 1 and 5",
      });
    }

    // Calculate overall rating
    const overall =
      (cleanliness + location + staffBehaviour + valueForMoney) / 4;

    // if(!bookingId) {
    //   return res.status(400).json({ success: false, message: "bookingId is required" });
    // }

    console.log("This is the value of overall rating: ", overall);

    const review = await Review.create({
      userId,
      propertyId,
      roomId,
      bookingId,
      rating: Number(overall.toFixed(1)), // overall rating
      ratings,
      comment,
      images: Array.isArray(images) ? images : [],
    });

    // IMPORTANT: Update property rating
    await updatePropertyRating(propertyId);

    res
      .status(201)
      .json({ success: true, message: "Review created", data: review });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const getReviews = async (req, res) => {
  try {
    const {
      propertyId,
      roomId,
      userId,
      bookingId,
      rating,
      isPublished,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId))
      filter.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (roomId && mongoose.Types.ObjectId.isValid(roomId))
      filter.roomId = new mongoose.Types.ObjectId(roomId);
    if (userId && mongoose.Types.ObjectId.isValid(userId))
      filter.userId = new mongoose.Types.ObjectId(userId);
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId))
      filter.bookingId = new mongoose.Types.ObjectId(bookingId);
    if (rating) filter.rating = Number(rating);
    if (typeof isPublished !== "undefined")
      filter.isPublished = isPublished === "true";
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

    res.status(200).json({
      success: true,
      count: items.length,
      total,
      page: Number(page),
      limit: Number(limit),
      data: items,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id)
      .populate("userId", "firstName lastName phone")
      .populate("propertyId", "basicPropertyDetails.name")
      .populate("roomId", "type");

    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });

    res.status(200).json({ success: true, data: review });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user?._id;

    if (!message)
      return res
        .status(400)
        .json({ success: false, message: "message is required" });

    const review = await Review.findById(id);
    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });

    review.reply = { message, repliedBy: userId, repliedAt: new Date() };
    await review.save();

    res
      .status(200)
      .json({ success: true, message: "Reply added", data: review });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};


export const overallReview = async (req, res) => {
  try {
    console.log("Welcome to the overallReview controller"); 
    const { propertyId, page = 1, limit = 10 } = req.query;
    console.log("Received propertyId:", propertyId);

    if (!propertyId || !mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Valid propertyId is required",
      });
    }

    const propertyObjectId = new mongoose.Types.ObjectId(propertyId);

    // -------------------------
    // Get rating summary
    // -------------------------
    const ratingSummary = await Review.aggregate([
      {
        $match: {
          propertyId: propertyObjectId,
          isPublished: true,
        },
      },
      {
        $group: {
          _id: "$propertyId",

          overallRating: { $avg: "$rating" },

          cleanlinessAvg: { $avg: "$ratings.cleanliness" },
          locationAvg: { $avg: "$ratings.location" },
          staffBehaviourAvg: { $avg: "$ratings.staffBehaviour" },
          valueForMoneyAvg: { $avg: "$ratings.valueForMoney" },

          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const summary =
      ratingSummary.length > 0
        ? ratingSummary[0]
        : {
            overallRating: 0,
            cleanlinessAvg: 0,
            locationAvg: 0,
            staffBehaviourAvg: 0,
            valueForMoneyAvg: 0,
            totalReviews: 0,
          };

    // -------------------------
    // Get reviews list
    // -------------------------
    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find({
      propertyId: propertyObjectId,
      isPublished: true,
    })
      .populate("userId", "firstName lastName")
      .populate("roomId", "type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // -------------------------
    // Response
    // -------------------------
    res.status(200).json({
      success: true,

      summary: {
        overallRating: Number(summary.overallRating?.toFixed(1) || 0),

        breakdown: {
          cleanliness: Number(summary.cleanlinessAvg?.toFixed(1) || 0),
          location: Number(summary.locationAvg?.toFixed(1) || 0),
          staffBehaviour: Number(summary.staffBehaviourAvg?.toFixed(1) || 0),
          valueForMoney: Number(summary.valueForMoneyAvg?.toFixed(1) || 0),
        },

        totalReviews: summary.totalReviews,
      },

      reviews,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.body?.userId);

    const review = await Review.findById(id);
    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });

    const isOwner = user && review.userId.toString() === user._id.toString();
    const isManager =
      user && (user.role === "admin" || user.role === "hotelier");

    if (!isOwner && !isManager) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const propertyId = review.propertyId;
    await review.deleteOne();

    await updatePropertyRating(propertyId);
    res
      .status(200)
      .json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ======================================================
// 🖼️ GET PROPERTY GUEST PHOTOS
// ======================================================
export const getPropertyGuestPhotos = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid propertyId",
      });
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Fetch only reviews that have images
    const reviews = await Review.find({
      propertyId: new mongoose.Types.ObjectId(propertyId),
      isPublished: true,
      images: { $exists: true, $not: { $size: 0 } },
    })
      .select("images userId createdAt")
      .populate("userId", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    // Flatten all images into a single array with metadata
    const allPhotos = reviews.flatMap((review) =>
      review.images.map((url) => ({
        url,
        uploadedBy: {
          id: review.userId?._id,
          name: `${review.userId?.firstName} ${review.userId?.lastName}`.trim(),
        },
        uploadedAt: review.createdAt,
      })),
    );

    const totalPhotos = allPhotos.length;

    // Paginate after flattening
    const paginated = allPhotos.slice(skip, skip + Number(limit));

    return res.status(200).json({
      success: true,
      totalPhotos, // for "91+ Guest Photos" label
      page: Number(page),
      limit: Number(limit),
      data: paginated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
