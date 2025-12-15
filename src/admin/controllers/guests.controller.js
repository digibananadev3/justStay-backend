import User from "../../models/user.model.js";
import RoomBooking from "../../models/roomBooking.model.js";
import Review from "../../models/review.model.js";
import Referral from "../../models/referral.model.js";
import Activity from "../../models/activity.model.js";
import SearchHistory from "../../models/searchHistory.model.js";
import Favorite from "../../models/favorite.model.js";
import Property from "../../models/property.model.js";


// GET /api/admin/guests/stats
// Counts only for users with role=customer
export const getGuestsStats = async (req, res) => {
  try {
    const [total, active, inactive, suspended, verified, unverified] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "customer", status: "active" }),
      User.countDocuments({ role: "customer", status: "inactive" }),
      User.countDocuments({ role: "customer", status: "banned" }),
      User.countDocuments({ role: "customer", isVerified: true }),
      User.countDocuments({ role: "customer", isVerified: false }),
    ]);
    res.status(200).json({ success: true, data: { total, active, inactive, suspended, verified, unverified } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/searches
export const getGuestSearches = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      SearchHistory.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("query tags createdAt"),
      SearchHistory.countDocuments({ userId: user._id })
    ]);

    if (items.length === 0) {
      const demo = [
        { query: "Hotels in Mumbai", tags: ["Luxury", "5-star", "location:Mumbai"], createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        { query: "Budget hotels near Airport", tags: ["Budget", "near:Airport", "location:Mumbai"], createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        { query: "Hourly booking Delhi", tags: ["Hourly", "location:Delhi NCR"], createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { query: "Hotels with pool in Goa", tags: ["Luxury", "Pool", "location:Goa"], createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      ];
      return res.status(200).json({ success: true, count: demo.length, total, page: Number(page), limit: Number(limit), data: demo });
    }

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/searches/preferences
export const getGuestSearchPreferences = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const rows = await SearchHistory.aggregate([
      { $match: { userId: user._id } },
      { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$tags", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 100 }
    ]);

    // simple parsing of tags like: location:City, near:Airport, rating:4+, type:Luxury|Budget|Hourly, price:2000-10000
    const tags = rows.map(r => r._id).filter(Boolean);
    const pick = (prefix) => tags.filter(t => typeof t === "string" && t.toLowerCase().startsWith(prefix)).map(t => t.split(":")[1]).filter(Boolean);

    const locations = Array.from(new Set([...pick("location:"), ...tags.filter(t => /goa|mumbai|delhi/i.test(t))])).slice(0, 5);
    const rating = tags.find(t => /^\s*4\+\s*stars?$/i.test(t)) || tags.find(t => /^rating:/i.test(t))?.split(":")[1] || null;
    const priceTag = tags.find(t => /^price:/i.test(t));
    const priceRange = priceTag ? priceTag.split(":")[1] : null;
    const bookingType = tags.find(t => /luxury|budget|hourly/i.test(t)) || null;

    const preferences = {
      preferredLocations: locations.length ? locations : ["Mumbai", "Delhi", "Goa"],
      priceRange: priceRange || "₹2,000 – ₹10,000",
      preferredRating: rating || "4+ Stars",
      bookingType: bookingType || "Mostly Luxury",
    };

    res.status(200).json({ success: true, data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/activity
export const getGuestActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Activity.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("type description meta createdAt"),
      Activity.countDocuments({ userId: user._id })
    ]);
    if(items.length === 0){
        const itemsDemo = [
            { "type": "login", "description": "Logged in from Mumbai", "meta": { "ip": "1.2.3.4" }, "createdAt": "2025-01-15T11:20:00.000Z" },
            { "type": "booking", "description": "Completed booking at Hotel Taj", "meta": { "bookingId": "b123" }, "createdAt": "2025-01-14T09:00:00.000Z" },
            { "type": "wallet", "description": "Added funds to wallet", "meta": { "amount": 1000 }, "createdAt": "2025-01-13T10:00:00.000Z" },
            { "type": "referral", "description": "Referred new user", "meta": { "refereeId": "u_101" }, "createdAt": "2025-01-12T15:00:00.000Z" }
          ]
        res.status(200).json({ success: true, count: itemsDemo.length, total, page: Number(page), limit: Number(limit), data: itemsDemo });
    }
    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/referrals/summary
export const getGuestReferralsSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "customer" }).select("firstName createdAt");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const [totalReferrals, activeReferrals, earningsAgg] = await Promise.all([
      Referral.countDocuments({ referrerId: user._id }),
      Referral.countDocuments({ referrerId: user._id, status: "Active" }),
      Referral.aggregate([
        { $match: { referrerId: user._id, status: { $in: ["Active", "Pending"] } } },
        { $group: { _id: null, sum: { $sum: { $ifNull: ["$rewardAmount", 0] } } } }
      ])
    ]);

    const earnings = (earningsAgg[0]?.sum) || 0;
    const referralCode = `${(user.firstName || "USER").toUpperCase().slice(0,5)}${user.createdAt.getUTCFullYear()}`;

    res.status(200).json({ success: true, data: { referralCode, totalReferrals, activeReferrals, earnings } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/referrals
export const getGuestReferralsList = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Referral.find({ referrerId: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate({ path: "refereeId", select: "firstName lastName phone createdAt" })
        .select("status rewardAmount joinedAt createdAt"),
      Referral.countDocuments({ referrerId: user._id })
    ]);

    const data = items.map(r => ({
      referee: r.refereeId,
      status: r.status,
      rewardAmount: r.rewardAmount,
      joinedAt: r.joinedAt,
      createdAt: r.createdAt,
    }));

    res.status(200).json({ success: true, count: data.length, total, page: Number(page), limit: Number(limit), data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/bookings
export const getGuestRecentBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      RoomBooking.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("status priceSummary.totalAmount stayDetails.roomType stayDetails.checkInDate propertyId createdAt"),
      RoomBooking.countDocuments({ userId: user._id })
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/bookings/summary
export const getGuestBookingSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id firstName createdAt");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setUTCMonth(now.getUTCMonth() - 11);

    const baseAgg = await RoomBooking.aggregate([
      { $match: { userId: user._id } },
      { $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          avgBookingValue: { $avg: { $ifNull: ["$priceSummary.totalAmount", 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "Cancel"] }, 1, 0] } }
      } }
    ]);
    const totals = baseAgg[0] || { totalBookings: 0, avgBookingValue: 0, cancelled: 0 };
    const cancellationRate = totals.totalBookings ? +(totals.cancelled * 100 / totals.totalBookings).toFixed(1) : 0;

    const monthlyRows = await RoomBooking.aggregate([
      { $match: { userId: user._id, createdAt: { $gte: oneYearAgo, $lte: now } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, c: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const monthCount = monthlyRows.length || 1;
    const monthlyFrequency = +(monthlyRows.reduce((a, b) => a + b.c, 0) / monthCount).toFixed(1);

    const timelineRows = await RoomBooking.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: "$status", c: { $sum: 1 } } }
    ]);
    const map = Object.fromEntries(timelineRows.map(r => [r._id, r.c]));
    const timeline = {
      upcoming: map.Booked || 0,
      ongoing: map.CheckIn || 0,
      completed: map.CheckOut || 0,
      cancelled: map.Cancel || 0,
    };

    const typeRows = await RoomBooking.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: "$stayDetails.roomType", c: { $sum: 1 } } },
      { $sort: { c: -1 } }
    ]);
    const typeTotal = typeRows.reduce((a, b) => a + b.c, 0) || 1;
    const preferredTypes = typeRows.map(t => ({ type: t._id || "Unknown", percent: Math.round((t.c * 100) / typeTotal) }));

    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setUTCDate(now.getUTCDate() - 30);
    const twelveWeeksAgo = new Date(now); twelveWeeksAgo.setUTCDate(now.getUTCDate() - 84);
    const last30 = await RoomBooking.countDocuments({ userId: user._id, createdAt: { $gte: thirtyDaysAgo } });
    const last12Weeks = await RoomBooking.countDocuments({ userId: user._id, createdAt: { $gte: twelveWeeksAgo } });
    const last12Months = await RoomBooking.countDocuments({ userId: user._id, createdAt: { $gte: oneYearAgo } });

    res.status(200).json({ success: true, data: {
      avgBookingValue: Math.round(totals.avgBookingValue || 0),
      cancellationRate,
      monthlyFrequency,
      totalBookings: totals.totalBookings || 0,
      timeline,
      preferredTypes,
      frequency: {
        dailyAvg: +(last30 / 30).toFixed(2),
        weeklyAvg: +(last12Weeks / 12).toFixed(2),
        monthlyAvg: +(last12Months / 12).toFixed(1)
      }
    }});
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id
export const getGuestDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "customer" })
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const [bookingsAgg, reviewsCount] = await Promise.all([
      RoomBooking.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalSpent: { $sum: { $ifNull: ["$priceSummary.totalAmount", 0] } }
          }
        }
      ]),
      Review.countDocuments({ userId: user._id })
    ]);

    const statsDoc = bookingsAgg[0] || { totalBookings: 0, totalSpent: 0 };

    res.status(200).json({
      success: true,
      data: {
        user,
        verification: {
          phoneVerified: !!user.isVerified
        },
        stats: {
          totalBookings: statsDoc.totalBookings,
          totalSpent: statsDoc.totalSpent,
          reviews: reviewsCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
// GET /api/admin/guests
// Query: search?, status?=Active|Inactive|Suspended, kyc?=Verified|Unverified, page?=1, limit?=20
// GET /api/admin/guests/:id/favorites
// GET /api/admin/guests/:id/favorites?page=1&limit=10&sort=recent|price_asc|price_desc
// GET /api/admin/guests/:id/favorites?tag=beachfront
// GET /api/admin/guests/:id/favorites?search=mumbai
// GET /api/admin/guests/:id/favorites?status=active|soldout
// GET /api/admin/guests/:id/favorites?minPrice=1000&maxPrice=10000
export const getGuestFavorites = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'recent',
      tag,
      search,
      status,
      minPrice,
      maxPrice
    } = req.query;

    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    // Build the base query
    const query = { userId: user._id };
    
    // Add tag filter if provided
    if (tag) {
      query.tags = { $in: [tag] };
    }

    // Add search filter (case-insensitive search on property name, city, or locality)
    if (search) {
      const propertyIds = await Property.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { 'address.city': { $regex: search, $options: 'i' } },
          { 'address.locality': { $regex: search, $options: 'i' } },
        ]
      }).distinct('_id');
      
      query.propertyId = { $in: propertyIds };
    }

    // Add status filter if provided
    if (status) {
      const propertyIds = await Property.find({ status }).distinct('_id');
      if (!query.propertyId) query.propertyId = {};
      query.propertyId.$in = propertyIds;
    }

    // Add price range filter if provided
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);
      
      const propertyIds = await Property.find({
        'roomTypes.pricePerNight': priceFilter
      }).distinct('_id');
      
      if (!query.propertyId) query.propertyId = {};
      query.propertyId.$in = propertyIds;
    }

    // Define sort options
    let sortOption = { addedAt: -1 }; // Default: Most recent first
    if (sort === 'price_asc') sortOption = { 'property.roomTypes.pricePerNight': 1 };
    if (sort === 'price_desc') sortOption = { 'property.roomTypes.pricePerNight': -1 };

    const skip = (Number(page) - 1) * Number(limit);
    
    // Get paginated favorites with property details
    const [items, total] = await Promise.all([
      Favorite.find(query)
        .populate({
          path: 'property',
          select: 'name address.thumbnail address.city address.locality roomTypes.pricePerNight rating status',
          populate: {
            path: 'roomTypes',
            select: 'pricePerNight',
            perDocumentLimit: 1
          }
        })
        .sort(sort === 'recent' ? { addedAt: -1 } : sortOption)
        .skip(skip)
        .limit(Number(limit))
        .select('propertyId addedAt notes tags')
        .lean(),
      Favorite.countDocuments(query)
    ]);

    // If no favorites found, return demo data
    if (items.length === 0) {
      const demo = [
        {
          _id: '6612a1b2c3d4e5f6a7b8c9d1',
          propertyId: '6612a1b2c3d4e5f6a7b8c9d1',
          property: {
            _id: '6612a1b2c3d4e5f6a7b8c9d1',
            name: 'Taj Lands End',
            address: {
              thumbnail: 'https://example.com/taj-lands-end.jpg',
              city: 'Mumbai',
              locality: 'Bandra West'
            },
            roomTypes: [{
              pricePerNight: 15000
            }],
            rating: 4.8,
            status: 'active'
          },
          addedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          notes: 'Perfect for weekend getaway',
          tags: ['Luxury', 'Beachfront']
        },
        {
          _id: '6612a1b2c3d4e5f6a7b8c9d2',
          propertyId: '6612a1b2c3d4e5f6a7b8c9d2',
          property: {
            _id: '6612a1b2c3d4e5f6a7b8c9d2',
            name: 'ITC Grand Chola',
            address: {
              thumbnail: 'https://example.com/itc-grand-chola.jpg',
              city: 'Chennai',
              locality: 'Guindy'
            },
            roomTypes: [{
              pricePerNight: 12000
            }],
            rating: 4.7,
            status: 'active'
          },
          addedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          notes: 'Great business hotel',
          tags: ['Business', 'Luxury']
        }
      ];
      return res.status(200).json({ 
        success: true, 
        count: demo.length, 
        total: demo.length, 
        page: Number(page), 
        limit: Number(limit), 
        data: demo 
      });
    }

    // Format response
    const formattedItems = items.map(item => ({
      _id: item._id,
      propertyId: item.propertyId,
      property: {
        _id: item.property?._id,
        name: item.property?.name,
        thumbnail: item.property?.address?.thumbnail,
        city: item.property?.address?.city,
        locality: item.property?.address?.locality,
        price: item.property?.roomTypes?.[0]?.pricePerNight || 0,
        rating: item.property?.rating,
        status: item.property?.status
      },
      addedAt: item.addedAt,
      notes: item.notes,
      tags: item.tags || []
    }));

    res.status(200).json({ 
      success: true, 
      count: formattedItems.length, 
      total, 
      page: Number(page), 
      limit: Number(limit), 
      data: formattedItems 
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/favorites/summary
export const getGuestFavoritesSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    // Get total favorites count
    const totalFavorites = await Favorite.countDocuments({ userId: user._id });
    
    // Get most common tags
    const tagStats = await Favorite.aggregate([
      { $match: { userId: user._id } },
      { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get price range of favorited properties
    const priceStats = await Favorite.aggregate([
      { $match: { userId: user._id } },
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'property'
        }
      },
      { $unwind: '$property' },
      { $unwind: '$property.roomTypes' },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$property.roomTypes.pricePerNight' },
          maxPrice: { $max: '$property.roomTypes.pricePerNight' },
          avgPrice: { $avg: '$property.roomTypes.pricePerNight' }
        }
      }
    ]);

    // Get most recent favorite
    const mostRecent = await Favorite.findOne({ userId: user._id })
      .sort({ addedAt: -1 })
      .populate('property', 'name address.city')
      .select('propertyId addedAt')
      .lean();

    // Prepare response
    const response = {
      totalFavorites,
      topTags: tagStats.map(tag => ({
        name: tag._id,
        count: tag.count
      })),
      priceRange: priceStats[0] ? {
        min: priceStats[0].minPrice || 0,
        max: priceStats[0].maxPrice || 0,
        avg: priceStats[0].avgPrice ? Math.round(priceStats[0].avgPrice) : 0
      } : { min: 0, max: 0, avg: 0 },
      mostRecent: mostRecent ? {
        propertyId: mostRecent.propertyId,
        propertyName: mostRecent.property?.name,
        city: mostRecent.property?.address?.city,
        addedAt: mostRecent.addedAt
      } : null
    };

    // If no favorites, return demo data
    if (totalFavorites === 0) {
      response.demo = true;
      response.totalFavorites = 8;
      response.topTags = [
        { name: 'Luxury', count: 4 },
        { name: 'Beachfront', count: 3 },
        { name: 'Business', count: 2 },
        { name: 'Resort', count: 2 },
        { name: 'Weekend Getaway', count: 1 }
      ];
      response.priceRange = {
        min: 3500,
        max: 25000,
        avg: 12000
      };
      response.mostRecent = {
        propertyId: '6612a1b2c3d4e5f6a7b8c9d1',
        propertyName: 'Taj Lands End',
        city: 'Mumbai',
        addedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      };
    }

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    console.error('Error fetching favorites summary:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/reviews/summary
export const getGuestReviewsSummary = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify guest exists
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    // Get review statistics using aggregation
    const reviewStats = await Review.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          ratingDistribution: {
            $push: {
              rating: "$rating",
              count: 1
            }
          },
          totalProperties: { $addToSet: "$propertyId" },
          lastReviewDate: { $max: "$createdAt" }
        }
      },
      {
        $project: {
          _id: 0,
          totalReviews: 1,
          averageRating: { $round: ["$averageRating", 1] },
          ratingDistribution: {
            $arrayToObject: {
              $map: {
                input: [1, 2, 3, 4, 5],
                as: "r",
                in: {
                  k: { $toString: "$$r" },
                  v: {
                    $size: {
                      $filter: {
                        input: "$ratingDistribution",
                        as: "rd",
                        cond: { $eq: ["$$rd.rating", "$$r"] }
                      }
                    }
                  }
                }
              }
            }
          },
          totalProperties: { $size: "$totalProperties" },
          lastReviewDate: 1
        }
      }
    ]);

    // Get most recent review with property details
    const mostRecentReview = await Review.findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .populate('propertyId', 'name thumbnail')
      .select('rating comment createdAt propertyId')
      .lean();

    // Prepare response
    const response = reviewStats[0] || {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalProperties: 0
    };

    // Add most recent review info if available
    if (mostRecentReview) {
      response.mostRecentReview = {
        rating: mostRecentReview.rating,
        comment: mostRecentReview.comment,
        date: mostRecentReview.createdAt,
        property: mostRecentReview.propertyId ? {
          id: mostRecentReview.propertyId._id,
          name: mostRecentReview.propertyId.name,
          thumbnail: mostRecentReview.propertyId.thumbnail
        } : null
      };
    }

    // If no reviews, return demo data
    if (response.totalReviews === 0) {
      response.demo = true;
      response.totalReviews = 12;
      response.averageRating = 4.3;
      response.ratingDistribution = { 1: 0, 2: 1, 3: 2, 4: 5, 5: 4 };
      response.totalProperties = 8;
      response.mostRecentReview = {
        rating: 5,
        comment: "Excellent stay with amazing hospitality. Would definitely come back!",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        property: {
          id: "6612a1b2c3d4e5f6a7b8c9d1",
          name: "Taj Lands End",
          thumbnail: "https://example.com/taj-lands-end.jpg"
        }
      };
    }

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    console.error('Error fetching reviews summary:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// GET /api/admin/guests/:id/reviews
export const getGuestReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'recent',
      minRating,
      maxRating,
      propertyId,
      search
    } = req.query;

    // Verify guest exists
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    // Build the base query
    const query = { userId: user._id };
    
    // Add rating filters if provided
    if (minRating || maxRating) {
      query.rating = {};
      if (minRating) query.rating.$gte = Number(minRating);
      if (maxRating) query.rating.$lte = Number(maxRating);
    }

    // Filter by property if provided
    if (propertyId) {
      query.propertyId = propertyId;
    }

    // Search in comments if search term provided
    if (search) {
      query.comment = { $regex: search, $options: 'i' };
    }

    // Define sort options
    let sortOption = { createdAt: -1 }; // Default: Most recent first
    if (sort === 'rating_asc') sortOption = { rating: 1 };
    if (sort === 'rating_desc') sortOption = { rating: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };

    const skip = (Number(page) - 1) * Number(limit);
    
    // Get paginated reviews with property details
    const [items, total] = await Promise.all([
      Review.find(query)
        .populate('propertyId', 'name thumbnail')
        .populate('reply.repliedBy', 'firstName lastName')
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .select('rating comment images isPublished reply createdAt')
        .lean(),
      Review.countDocuments(query)
    ]);

    // Format response
    const formattedItems = items.map(item => ({
      id: item._id,
      rating: item.rating,
      comment: item.comment,
      images: item.images || [],
      isPublished: item.isPublished,
      date: item.createdAt,
      property: item.propertyId ? {
        id: item.propertyId._id,
        name: item.propertyId.name,
        thumbnail: item.propertyId.thumbnail
      } : null,
      reply: item.reply ? {
        message: item.reply.message,
        repliedBy: item.reply.repliedBy ? {
          id: item.reply.repliedBy._id,
          name: `${item.reply.repliedBy.firstName} ${item.reply.repliedBy.lastName}`.trim()
        } : null,
        repliedAt: item.reply.repliedAt
      } : null
    }));

    // If no reviews, return demo data
    if (formattedItems.length === 0) {
      const demo = [
        {
          id: '6612a1b2c3d4e5f6a7b8c9d1',
          rating: 5,
          comment: "Excellent stay with amazing hospitality. The room was clean and the staff was very helpful. Would definitely come back!",
          images: [
            "https://example.com/reviews/room1.jpg",
            "https://example.com/reviews/view1.jpg"
          ],
          isPublished: true,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          property: {
            id: "6612a1b2c3d4e5f6a7b8c9d1",
            name: "Taj Lands End",
            thumbnail: "https://example.com/taj-lands-end.jpg"
          },
          reply: {
            message: "Thank you for your wonderful review! We're delighted you enjoyed your stay and look forward to welcoming you back soon.",
            repliedBy: {
              id: "6612a1b2c3d4e5f6a7b8c9d9",
              name: "Hotel Manager"
            },
            repliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          }
        },
        {
          id: '6612a1b2c3d4e5f6a7b8c9d2',
          rating: 4,
          comment: "Great location and comfortable rooms. The breakfast spread was amazing!",
          images: [],
          isPublished: true,
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          property: {
            id: "6612a1b2c3d4e5f6a7b8c9d2",
            name: "ITC Grand Chola",
            thumbnail: "https://example.com/itc-grand-chola.jpg"
          },
          reply: null
        }
      ];
      
      return res.status(200).json({ 
        success: true, 
        count: demo.length, 
        total: 12, 
        page: Number(page), 
        limit: Number(limit), 
        data: demo 
      });
    }

    res.status(200).json({ 
      success: true, 
      count: formattedItems.length, 
      total, 
      page: Number(page), 
      limit: Number(limit), 
      data: formattedItems 
    });
  } catch (error) {
    console.error('Error fetching guest reviews:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listGuests = async (req, res) => {
  try {
    const { search, status, kyc, page = 1, limit = 20 } = req.query;

    const filter = { role: "customer" };
    if (search) {
      const q = new RegExp(search, "i");
      filter.$or = [{ firstName: q }, { lastName: q }, { phone: q }];
      // email is commented in schema, so we skip it to avoid confusion
    }

    if (status) {
      const map = { Active: "active", Inactive: "inactive", Suspended: "banned", active: "active", inactive: "inactive", suspended: "banned" };
      const val = map[status] || status;
      filter.status = val;
    }

    if (kyc) {
      if (["Verified", "verified", "true", true].includes(kyc)) filter.isVerified = true;
      if (["Unverified", "unverified", "false", false].includes(kyc)) filter.isVerified = false;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("firstName lastName phone role isVerified status createdAt"),
      User.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
