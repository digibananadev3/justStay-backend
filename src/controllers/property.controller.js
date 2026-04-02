import PropertyInfo from "../models/property.model.js";
import PropertyRoom from "../models/propertyRoom.model.js";
import mongoose from "mongoose";
import { Parser } from "@json2csv/plainjs";
import Review from "../models/review.model.js";

// -----------------------------
// Update Property Rating (After Review Created/Updated/Deleted)
// -----------------------------
export const updatePropertyRating = async (propertyId) => {
  const result = await Review.aggregate([
    {
      $match: {
        propertyId: new mongoose.Types.ObjectId(propertyId),
        isPublished: true,
      },
    },
    {
      $group: {
        _id: "$propertyId",
        avgRating: { $avg: "$rating" },
        guestTotalReviews: { $sum: 1 },
      },
    },
  ]);

  let avgRating = 0;
  let guestTotalReviews = 0;

  if (result.length > 0) {
    avgRating = result[0].avgRating;
    guestTotalReviews = result[0].guestTotalReviews;
  }

  await PropertyInfo.findByIdAndUpdate(propertyId, {
    guestAverageRating: Number(avgRating.toFixed(1)),
    guestTotalReviews,
  });
};

// -----------------------------
// Update Property Pricing (Hotelier)
// -----------------------------
export const updatePropertyPricing = async (propertyId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return;
    }

    const result = await PropertyRoom.aggregate([
      {
        $match: {
          propertyId: new mongoose.Types.ObjectId(propertyId),
        },
      },

      {
        $project: {
          oneNightPrices: [
            "$pricing.oneNight.roomOnly",
            "$pricing.oneNight.withBreakfast",
          ],
          threeHourPrices: [
            "$pricing.threeHours.roomOnly",
            "$pricing.threeHours.withBreakfast",
          ],
          sixHourPrices: [
            "$pricing.sixHours.roomOnly",
            "$pricing.sixHours.withBreakfast",
          ],
        },
      },

      {
        $project: {
          allOneNight: {
            $filter: {
              input: { $setUnion: ["$oneNightPrices"] },
              as: "price",
              cond: { $ne: ["$$price", null] },
            },
          },
          allThreeHours: {
            $filter: {
              input: { $setUnion: ["$threeHourPrices"] },
              as: "price",
              cond: { $ne: ["$$price", null] },
            },
          },
          allSixHours: {
            $filter: {
              input: { $setUnion: ["$sixHourPrices"] },
              as: "price",
              cond: { $ne: ["$$price", null] },
            },
          },
        },
      },

      {
        $group: {
          _id: null,

          minOneNight: { $min: { $min: "$allOneNight" } },
          maxOneNight: { $max: { $max: "$allOneNight" } },

          minThreeHours: { $min: { $min: "$allThreeHours" } },
          maxThreeHours: { $max: { $max: "$allThreeHours" } },

          minSixHours: { $min: { $min: "$allSixHours" } },
          maxSixHours: { $max: { $max: "$allSixHours" } },
        },
      },
    ]);

    const pricing = result[0] || {};

    await PropertyInfo.findByIdAndUpdate(propertyId, {
      pricing: {
        minOneNightPrice: pricing.minOneNight || 0,
        maxOneNightPrice: pricing.maxOneNight || 0,
        minThreeHoursPrice: pricing.minThreeHours || 0,
        maxThreeHoursPrice: pricing.maxThreeHours || 0,
        minSixHoursPrice: pricing.minSixHours || 0,
        maxSixHoursPrice: pricing.maxSixHours || 0,
      },
    });
  } catch (error) {
    console.error(
      "Error updating property pricing for propertyId:",
      propertyId,
      "Error:",
      error,
    );
  }
};

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
    const properties = await PropertyInfo.find({ isDeleted: false }).populate(
      "userId",
      "firstName lastName email phone role",
    );
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
    const property = await PropertyInfo.findOne({
      _id: req.params.id,
      isDeleted: false,
    }).populate("userId", "firstName lastName email phone role");

    if (!property)
      return res.status(404).json({ message: "Property not found" });

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
    const property = await PropertyInfo.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!property)
      return res.status(404).json({ message: "Property not found" });

    // Optional: Only allow owner or admin to update
    if (
      property.userId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this property" });
    }

    Object.assign(property, req.body); // merge updates
    await property.save();

    res
      .status(200)
      .json({ message: "Property updated successfully", property });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Delete Property (Hotelier/Admin)
// -----------------------------
export const deleteProperty = async (req, res) => {
  try {
    const property = await PropertyInfo.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!property)
      return res.status(404).json({ message: "Property not found" });

    // Optional: Only allow owner or admin to delete
    if (
      property.userId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this property" });
    }

    // await property.remove();
    property.isDeleted = true;
    property.deletedAt = new Date();
    await property.save();

    res.status(200).json({ message: "Property soft deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Sort And Filter Properties (Guest)
// -----------------------------
export const sortAndFilterProperties = async (req, res) => {
  try {
    const {
      lat,
      lng,
      minPrice,
      maxPrice,
      starRating,
      guestRating,
      amenities,
      stayType,
      sortBy,
      city,
      state,
      search
    } = req.query;

    console.log("query", req.query);

    const matchQuery = {
      isDeleted: false,
      listingStatus: { $in: ["approved", "pending"] },
    };

    // -----------------------------
    // Escape Regex (Security Fix)
    // -----------------------------
    const escapeRegex = (text) =>{
      text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // -----------------------------
    // Search Filter
    // -----------------------------
        if (search && search.trim()) {
          const safeSearch = escapeRegex(search.trim());
          const orConditions = [
            { "basicPropertyDetails.name": { $regex: search, $options: "i" } },
            { "location.state": { $regex: search, $options: "i" }  },
            { "location.city": { $regex: search, $options: "i" }  },
            { "location.area": { $regex: search, $options: "i" }  },
             { "location.landmarks": { $regex: search, $options: "i" } },
            { "contactDetails.email": { $regex: search, $options: "i" } },
          ];
    
          // If search is a valid Mongo ObjectId, include it
          if (mongoose.Types.ObjectId.isValid(search)) {
            orConditions.push({ _id: new mongoose.Types.ObjectId(search) });
          }
    
           matchQuery.$and = [
        ...(matchQuery.$and || []),
        { $or: orConditions },
      ];
        }

    // -----------------------------
    // Location Filter
    // -----------------------------
    if (city) matchQuery["location.city"] = new RegExp(city, "i");
    if (state) matchQuery["location.state"] = new RegExp(state, "i");

    // -----------------------------
    // Stay Type Filter
    // -----------------------------
    if (stayType) {
      matchQuery.stayType = {
        $in: stayType.split(","),
      };
    }

    // -----------------------------
    // Amenities Filter
    // -----------------------------
    if (amenities) {
      matchQuery.propertyAmenities = {
        $in: amenities.split(","),
      };
    }

    // -----------------------------
    // Price Filter
    // -----------------------------
    if (minPrice || maxPrice) {
      matchQuery["pricing.minOneNightPrice"] = {
        $gte: Number(minPrice || 0),
        $lte: Number(maxPrice || 9999999),
      };
    }

    // -----------------------------
    // Hotel Star Rating Filter
    // -----------------------------
    if (starRating) {
      matchQuery.hotelRating = {
        $gte: Number(starRating),
      };
    }

    // -----------------------------
    // Guest Rating Filter
    // -----------------------------
    if (guestRating) {
      matchQuery.guestAverageRating = {
        $gte: Number(guestRating),
      };
    }

    let pipeline = [];

    // -----------------------------
    // GEO Search
    // -----------------------------
    if (lat && lng) {
      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: "distance",
          spherical: true,
          query: matchQuery,
        },
      });
    } else {
      pipeline.push({ $match: matchQuery });
    }

    // -----------------------------
    // Most Popular (booking count)
    // -----------------------------
    if (sortBy === "mostPopular") {
      pipeline.push({
        $lookup: {
          from: "roombookings",
          localField: "_id",
          foreignField: "propertyId",
          as: "bookings",
        },
      });

      pipeline.push({
        $addFields: {
          bookingCount: { $size: "$bookings" },
        },
      });
    }

    // -----------------------------
    // Sorting
    // -----------------------------
    let sortStage = {};

    switch (sortBy) {
      case "priceLow":
        sortStage = { "pricing.minOneNightPrice": 1 };
        break;

      case "priceHigh":
        sortStage = { "pricing.minOneNightPrice": -1 };
        break;

      case "guestRatingLow":
        sortStage = { guestAverageRating: 1 };
        break;

      case "guestRatingHigh":
        sortStage = { guestAverageRating: -1 };
        break;

      case "starRatingLow":
        sortStage = { hotelRating: 1 };
        break;

      case "starRatingHigh":
        sortStage = { hotelRating: -1 };
        break;

      case "distanceLow":
        if (lat && lng) sortStage = { distance: 1 };
        else sortStage = { guestAverageRating: -1 };
        break;

      case "distanceHigh":
        if (lat && lng) sortStage = { distance: -1 };
        else sortStage = { guestAverageRating: -1 };
        break;

      case "mostPopular":
        sortStage = { bookingCount: -1 };
        break;

      case "bestValue":
        // Lowest price + highest rating
        sortStage = {
          "pricing.minOneNightPrice": 1,
          guestAverageRating: -1,
        };
        break;

      default:
        sortStage = { guestAverageRating: -1 };
    }

    pipeline.push({ $sort: sortStage });
    // pipeline.push({ $limit: 20 });

    const properties = await PropertyInfo.aggregate(pipeline);

    res.status(200).json({
      success: true,
      total: properties.length,
      data: properties,
    });
  } catch (error) {
    console.error("Filter Error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
};

// -----------------------------
// Top Picks For You
// -----------------------------
export const getTopPicksForUser = async (req, res) => {
  try {
    const { longitude, latitude } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        status: "error",
        message: "Longitude and latitude required",
      });
    }

    const nearbyProperties  = await PropertyInfo.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          distanceField: "distance",
          maxDistance: 20000, // 20 KM
          spherical: true,
        },
      },
      {
        $match: {
          isDeleted: false,
          // listingStatus: "approved",
          // status: "Accepted",
        },
      },
      {
        $sort: {
          distance: 1,
          guestAverageRating: -1,
        },
      },
      { $limit: 10 },
    ]);




    res.json({
      status: "success",
      nearbyCount: nearbyProperties.length,
      nearbyProperties,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

// -----------------------------
// Set Property Coordinates (Hotelier/Admin)
// -----------------------------
export const setPropertyCoordinates = async (req, res) => {
  try {
    const { propertyId, longitude, latitude } = req.body;

    if (!propertyId || !longitude || !latitude) {
      return res.status(400).json({
        status: "error",
        message: "propertyId, longitude and latitude are required",
      });
    }

    const property = await PropertyInfo.findByIdAndUpdate(
      propertyId,
      {
        "location.coordinates": {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
      },
      { new: true },
    );

    if (!property) {
      return res.status(404).json({
        status: "error",
        message: "Property not found",
      });
    }

    res.json({
      status: "success",
      message: "Coordinates updated successfully",
      data: property,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

// -----------------------------
// Get Similar Properties
// -----------------------------
// export const getSimilarProperties = async (req, res) => {
//   try {
//     const { propertyId } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(propertyId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid propertyId",
//       });
//     }

//     // 1. Get current property
//     const currentProperty = await PropertyInfo.findById(propertyId);


//     if (!currentProperty || currentProperty.isDeleted) {
//       return res.status(404).json({
//         success: false,
//         message: "Property not found",
//       });
//     }

//     const city = currentProperty.location.city;
//     const propertyType = currentProperty.propertyType;
//     const basePrice = currentProperty.pricing.minOneNightPrice || 0;
//     const rating = currentProperty.guestAverageRating || 0;

//     // 2. Build similarity query
//     const similarProperties = await PropertyInfo.find({
//       _id: { $ne: propertyId }, // exclude current property
//       // isDeleted: false,
//       // listingStatus: "approved",

//       "location.city": new RegExp(city, "i"), // same city
//       propertyType: propertyType, // same property type

//       "pricing.minOneNightPrice": {
//         $gte: basePrice - 2000,
//         $lte: basePrice + 2000,
//       },

//       guestAverageRating: {
//         $gte: rating - 1, // similar rating range
//       },
//     })
//       .sort({ guestAverageRating: -1 })
//       .limit(6);

//     res.status(200).json({
//       success: true,
//       total: similarProperties.length,
//       data: similarProperties,
//     });
//   } catch (error) {
//     console.error("Similar property error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch similar properties",
//     });
//   }
// };

// -----------------------------
// Get Similar Properties (Smart Version)
// -----------------------------
export const getSimilarProperties = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid propertyId",
      });
    }

    const currentProperty = await PropertyInfo.findById(propertyId);

    if (!currentProperty || currentProperty.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const city = currentProperty.location.city;
    const propertyType = currentProperty.propertyType;
    const basePrice = currentProperty.pricing.minOneNightPrice || 0;

    let similarProperties = [];

    // Strict match
    similarProperties = await PropertyInfo.find({
      _id: { $ne: propertyId },
      // isDeleted: false,
      // listingStatus: "approved",
      "location.city": new RegExp(city, "i"),
      propertyType: propertyType,
      "pricing.minOneNightPrice": {
        $gte: basePrice - 2000,
        $lte: basePrice + 2000,
      },
    })
      .sort({ guestAverageRating: -1 })
      .limit(6);

    // 2️⃣ If less than 3 results → remove price filter
    if (similarProperties.length < 3) {
      similarProperties = await PropertyInfo.find({
        _id: { $ne: propertyId },
        // isDeleted: false,
        // listingStatus: "approved",
        "location.city": new RegExp(city, "i"),
        propertyType: propertyType,
      })
        .sort({ guestAverageRating: -1 })
        .limit(6);
    }

    // 3️⃣ If still empty → match only by city
    if (similarProperties.length === 0) {
      similarProperties = await PropertyInfo.find({
        _id: { $ne: propertyId },
        // isDeleted: false,
        // listingStatus: "approved",
        "location.city": new RegExp(city, "i"),
      })
        .sort({ guestAverageRating: -1 })
        .limit(6);
    }

    res.status(200).json({
      success: true,
      total: similarProperties.length,
      data: similarProperties,
    });
  } catch (error) {
    console.error("Similar property error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch similar properties",
    });
  }
};



// ---------------------------------------
// Controller — Update PAN & Aadhaar
// ---------------------------------------
export const updatePanAadhar = async (req, res) => {
  try {
    const { propertyId, panNumber, panFront, panBack, aadharNumber, aadharFront, aadharBack } = req.body;

    if (!propertyId) {
      return res.status(400).json({ message: "propertyId is required" });
    }

    const property = await PropertyInfo.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if(!panNumber || !panFront || !panBack || !panFront || !aadharNumber || !aadharFront || !aadharBack){
      return res.status(400).json({
        success : false,
        message : "Both Pan and Aadhar Card all details required"
      })
    }

    property.pan = {
      number: panNumber,
      front: panFront,
      back: panBack,
    };

    property.aadhar = {
      number: aadharNumber,
      front: aadharFront,
      back: aadharBack,
    };

    property.screenNumber = 90;

    await property.save();

    res.status(200).json({
      message: "PAN & Aadhaar updated successfully",
      property,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// ---------------------------------------
// Controller — Update Bank Details
// ---------------------------------------
export const updateBankDetails = async (req, res) => {
  try {
    const { propertyId, bankName, accountNumber, ifscCode } = req.body;

    if (!propertyId) {
      return res.status(400).json({ message: "propertyId required" });
    }

    const property = await PropertyInfo.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    property.bankDetails = {
      name: bankName,
      accountNumber: accountNumber,
      ifscCode: ifscCode,
    };

    property.screenNumber = 91;

    await property.save();

    res.status(200).json({
      message: "Bank details updated successfully",
      property,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// ---------------------------------------------
// Controller — Update GST & Business License
// ---------------------------------------------
export const updateGstBusinessLicense = async (req, res) => {
  try {
    const {
      propertyId,
      gstNumber,
      gstFront,
      gstBack,
      licenseNumber,
      licenseFront,
      licenseBack,
    } = req.body;

    if (!propertyId) {
      return res.status(400).json({ message: "propertyId required" });
    }

    const property = await PropertyInfo.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    property.gst = {
      number: gstNumber,
      front: gstFront,
      back: gstBack,
    };

    property.businessLicense = {
      number: licenseNumber,
      front: licenseFront,
      back: licenseBack,
    };

    property.screenNumber = 92;

    await property.save();

    res.status(200).json({
      message: "GST & Business License updated successfully",
      property,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};