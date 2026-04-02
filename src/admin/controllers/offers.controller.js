import mongoose from "mongoose";
import Offer from "../../models/offer.model.js";
import User from "../../models/user.model.js";
import RoomBooking from "../../models/roomBooking.model.js";
import PropertyInfo from "../../models/property.model.js";

/**
 * @desc    Get summary of guest's offers
 * @route   GET /api/admin/guests/:id/offers/summary
 * @access  Private/Admin
 */
export const getGuestOffersSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "customer" }).select(
      "_id",
    );

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Guest not found" });

    // Get active offers count
    const now = new Date();
    const activeOffers = await Offer.countDocuments({
      userId: user._id,
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    });

    // Get total offers count
    const totalOffers = await Offer.countDocuments({ userId: user._id });

    // Get most recent offer
    const recentOffer = await Offer.findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .select("title discountType discountValue validUntil isActive")
      .lean();

    // Get offers by type
    const offersByType = await Offer.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: "$discountType", count: { $sum: 1 } } },
    ]);

    // Prepare response
    const summary = {
      totalOffers,
      activeOffers,
      recentOffer,
      offersByType: offersByType.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
    };

    // Fallback demo data if no offers found
    if (totalOffers === 0) {
      summary.demo = true;
      summary.totalOffers = 5;
      summary.activeOffers = 2;
      summary.recentOffer = {
        title: "Summer Special 25% Off",
        discountType: "percentage",
        discountValue: 25,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        isActive: true,
      };
      summary.offersByType = {
        percentage: 3,
        fixed: 1,
        free_night: 1,
      };
    }

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("Error fetching offers summary:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * @desc    Get paginated list of guest's offers with filtering and sorting
 * @route   GET /api/admin/guests/:id/offers
 * @access  Private/Admin
 */



export const getGuestOffers = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 10,
      status = "all", // all, active, expired, upcoming
      type, // percentage, fixed, free_night
      sort = "recent", // recent, oldest, highest_discount, lowest_discount
    } = req.query;

    const user = await User.findOne({ _id: id, role: "customer" }).select(
      "_id",
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Guest not found" });

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    // Build query
    const query = { userId: user._id };

    // Filter by status
    if (status === "active") {
      query.isActive = true;
      query.validFrom = { $lte: now };
      query.validUntil = { $gte: now };
    } else if (status === "expired") {
      query.validUntil = { $lt: now };
    } else if (status === "upcoming") {
      query.validFrom = { $gt: now };
    }

    // Filter by type
    if (type) {
      query.discountType = type;
    }

    // Build sort
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    } else if (sort === "highest_discount") {
      sortOption = { discountValue: -1 };
    } else if (sort === "lowest_discount") {
      sortOption = { discountValue: 1 };
    }

    // Get paginated results
    const [items, total] = await Promise.all([
      Offer.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .select(
          "title description discountType discountValue minStay minAmount validFrom validUntil promoCode isActive usedCount usageLimit",
        )
        .lean(),
      Offer.countDocuments(query),
    ]);

    // Add isCurrentlyActive flag
    const itemsWithStatus = items.map((offer) => ({
      ...offer,
      isCurrentlyActive:
        offer.isActive &&
        offer.validFrom <= now &&
        offer.validUntil >= now &&
        (offer.usageLimit ? offer.usedCount < offer.usageLimit : true),
    }));

    // If no offers found, return demo data
    if (items.length === 0) {
      const demoOffers = [
        {
          _id: "6612a1b2c3d4e5f6a7b8c9d1",
          title: "Summer Special 25% Off",
          description: "Get 25% off on all bookings for summer season",
          discountType: "percentage",
          discountValue: 25,
          minStay: 2,
          minAmount: 0,
          validFrom: new Date("2025-05-01T00:00:00.000Z"),
          validUntil: new Date("2025-08-31T23:59:59.999Z"),
          promoCode: "SUMMER25",
          isActive: true,
          usedCount: 3,
          usageLimit: 50,
          isCurrentlyActive: true,
        },
        {
          _id: "6612a1b2c3d4e5f6a7b8c9d2",
          title: "Weekend Getaway - Flat ₹2000 Off",
          description: "Flat ₹2000 off on weekend bookings",
          discountType: "fixed",
          discountValue: 2000,
          minStay: 1,
          minAmount: 5000,
          validFrom: new Date("2025-04-01T00:00:00.000Z"),
          validUntil: new Date("2025-12-31T23:59:59.999Z"),
          promoCode: "WEEKEND2K",
          isActive: true,
          usedCount: 12,
          usageLimit: 100,
          isCurrentlyActive: true,
        },
      ];

      return res.status(200).json({
        success: true,
        count: demoOffers.length,
        total: demoOffers.length,
        page: Number(page),
        limit: Number(limit),
        data: demoOffers,
        demo: true,
      });
    }

    res.status(200).json({
      success: true,
      count: itemsWithStatus.length,
      total,
      page: Number(page),
      limit: Number(limit),
      data: itemsWithStatus,
    });
  } catch (error) {
    console.error("Error fetching guest offers:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};



export const createOffer = async (req, res) => {
  try {
    const {
      userId,
      title,
      description,
      discountType,
      discountValue,
      minStay,
      minAmount,
      validFrom,
      validUntil,
      promoCode,
      usageLimit,
      properties,
      tags,
    } = req.body;


    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    if (
      !title ||
      !discountType ||
      discountValue === undefined ||
      !validFrom ||
      !validUntil
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (
      discountType === "percentage" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Percentage discount must be between 0 and 100",
        });
    }

    if (discountType === "fixed" && discountValue < 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Fixed discount must be a positive number",
        });
    }

    if (
      discountType === "free_night" &&
      (discountValue < 1 || !Number.isInteger(discountValue))
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Free night discount must be an integer greater than 0",
        });
    }


    if(properties && !Array.isArray(properties)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Properties must be an array of property IDs",
        });
    }


//  Check every property id of the properties array exists in the database
    if (properties && properties.length > 0) {
      for (const propertyId of properties) {
        if (!mongoose.Types.ObjectId.isValid(propertyId)) {
          return res
            .status(400)
            .json({
              success: false,
              message: `Invalid property ID: ${propertyId}`,
            });
        }


        // Optionally, you can also check if the property exists in the database
        const propertyExists = await PropertyInfo.findById(propertyId);
        if (!propertyExists) {
          return res
            .status(400)
            .json({
              success: false,
              message: `Property not found for ID: ${propertyId}`,
            });
        }
      }
    }

    const user = await User.findById(userId);


    if (!user || user.role !== "hotelier" && user.role !== "admin") {
      return res
        .status(404)
        .json({ success: false, message: "Hotelier or Admin not found" });
    }

    const offer = await Offer.create({
      userId,
      title,
      description,
      discountType,
      discountValue,
      minStay,
      minAmount,
      validFrom,
      validUntil,
      promoCode,
      usageLimit,
      properties,
      tags,
      metadata: {
        createdBy: userId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      data: offer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const updateOffer = async (req, res) => {
  try {
    const { offerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await Offer.findByIdAndUpdate(
      offerId,
      {
        ...req.body,
        "metadata.updatedBy": req.body.userId,
        "metadata.updatedAt": new Date(),
      },
      { new: true },
    );

    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    }

    res.json({
      success: true,
      message: "Offer updated successfully",
      data: offer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const deleteOffer = async (req, res) => {
  try {
    const { offerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await Offer.findByIdAndDelete(offerId);

    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    }

    res.json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const getSingleOffer = async (req, res) => {
  try {
    const { offerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await Offer.findById(offerId)
      .populate("properties")
      .populate("metadata.createdBy", "name email")
      .lean();

    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    }

    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const getAllOffers = async (req, res) => {
  try {
    const offers = await Offer.find()
      .sort({ createdAt: -1 })
      .populate("properties")
      .lean();

    res.json({
      success: true,
      total: offers.length,
      data: offers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const applyPromoCode = async (req, res) => {
  try {
    const { promoCode, totalAmount, nights, propertyId } = req.body;

    if (!promoCode || !totalAmount || !nights || !propertyId) {
      return res.status(400).json({
        success: false,
        message: "promoCode, totalAmount, nights and propertyId are required",
      });
    }

    const now = new Date();

    const offer = await Offer.findOne({
      promoCode: promoCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    });

    if (!offer) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired promo code",
      });
    }

    if (
      offer.properties?.length &&
      !offer.properties.map((p) => p.toString()).includes(propertyId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Offer not valid for this property",
      });
    }

    if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Offer usage limit exceeded",
      });
    }

    if (totalAmount < offer.minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum booking amount is ${offer.minAmount}`,
      });
    }

    if (nights < offer.minStay) {
      return res.status(400).json({
        success: false,
        message: `Minimum stay required is ${offer.minStay} nights`,
      });
    }

    let discount = 0;

    if (offer.discountType === "percentage") {
      discount = (totalAmount * offer.discountValue) / 100;
    }

    if (offer.discountType === "fixed") {
      discount = offer.discountValue;
    }

    if (offer.discountType === "free_night") {
      const pricePerNight = totalAmount / nights;
      discount = offer.discountValue * pricePerNight;
    }

    const finalAmount = Math.max(totalAmount - discount, 0);

    res.json({
      success: true,
      message: "Promo applied successfully",
      discount,
      finalAmount,
      offerId: offer._id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const incrementOfferUsage = async (offerId) => {
  if (!mongoose.Types.ObjectId.isValid(offerId)) return;

  await Offer.findByIdAndUpdate(offerId, {
    $inc: { usedCount: 1 },
  });
};



export const toggleOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    res.json({
      success: true,
      message: "Offer status updated",
      data: offer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const getOffersYouWillLike = async (req, res) => {
  try {
    // const { id } = req.query;
    // console.log("Fetching personalized offers for guest ID:", id);

    // const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    // console.log("Guest found:", user);

    // if (!user)
    //   return res
    //     .status(404)
    //     .json({ success: false, message: "Guest not found" });
    const now = new Date();

    const offers = await Offer.find({
      isActive: true,
      // validFrom: { $lte: now },
      // validUntil: { $gte: now },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      // .populate("properties")
      .lean();

    res.json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    console.error("Error fetching personalized offers:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
