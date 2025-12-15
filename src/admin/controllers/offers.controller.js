import mongoose from 'mongoose';
import Offer from '../../models/offer.model.js';
import User from '../../models/user.model.js';

/**
 * @desc    Get summary of guest's offers
 * @route   GET /api/admin/guests/:id/offers/summary
 * @access  Private/Admin
 */
export const getGuestOffersSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    // Get active offers count
    const now = new Date();
    const activeOffers = await Offer.countDocuments({
      userId: user._id,
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    });

    // Get total offers count
    const totalOffers = await Offer.countDocuments({ userId: user._id });

    // Get most recent offer
    const recentOffer = await Offer.findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .select('title discountType discountValue validUntil isActive')
      .lean();

    // Get offers by type
    const offersByType = await Offer.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: "$discountType", count: { $sum: 1 } } }
    ]);

    // Prepare response
    const summary = {
      totalOffers,
      activeOffers,
      recentOffer,
      offersByType: offersByType.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {})
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
        isActive: true
      };
      summary.offersByType = {
        percentage: 3,
        fixed: 1,
        free_night: 1
      };
    }

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching offers summary:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
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
      status = 'all', // all, active, expired, upcoming
      type, // percentage, fixed, free_night
      sort = 'recent' // recent, oldest, highest_discount, lowest_discount
    } = req.query;

    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();
    
    // Build query
    const query = { userId: user._id };
    
    // Filter by status
    if (status === 'active') {
      query.isActive = true;
      query.validFrom = { $lte: now };
      query.validUntil = { $gte: now };
    } else if (status === 'expired') {
      query.validUntil = { $lt: now };
    } else if (status === 'upcoming') {
      query.validFrom = { $gt: now };
    }
    
    // Filter by type
    if (type) {
      query.discountType = type;
    }

    // Build sort
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'highest_discount') {
      sortOption = { discountValue: -1 };
    } else if (sort === 'lowest_discount') {
      sortOption = { discountValue: 1 };
    }

    // Get paginated results
    const [items, total] = await Promise.all([
      Offer.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .select('title description discountType discountValue minStay minAmount validFrom validUntil promoCode isActive usedCount usageLimit')
        .lean(),
      Offer.countDocuments(query)
    ]);

    // Add isCurrentlyActive flag
    const itemsWithStatus = items.map(offer => ({
      ...offer,
      isCurrentlyActive: offer.isActive && 
                        offer.validFrom <= now && 
                        offer.validUntil >= now &&
                        (offer.usageLimit ? offer.usedCount < offer.usageLimit : true)
    }));

    // If no offers found, return demo data
    if (items.length === 0) {
      const demoOffers = [
        {
          _id: '6612a1b2c3d4e5f6a7b8c9d1',
          title: 'Summer Special 25% Off',
          description: 'Get 25% off on all bookings for summer season',
          discountType: 'percentage',
          discountValue: 25,
          minStay: 2,
          minAmount: 0,
          validFrom: new Date('2025-05-01T00:00:00.000Z'),
          validUntil: new Date('2025-08-31T23:59:59.999Z'),
          promoCode: 'SUMMER25',
          isActive: true,
          usedCount: 3,
          usageLimit: 50,
          isCurrentlyActive: true
        },
        {
          _id: '6612a1b2c3d4e5f6a7b8c9d2',
          title: 'Weekend Getaway - Flat ₹2000 Off',
          description: 'Flat ₹2000 off on weekend bookings',
          discountType: 'fixed',
          discountValue: 2000,
          minStay: 1,
          minAmount: 5000,
          validFrom: new Date('2025-04-01T00:00:00.000Z'),
          validUntil: new Date('2025-12-31T23:59:59.999Z'),
          promoCode: 'WEEKEND2K',
          isActive: true,
          usedCount: 12,
          usageLimit: 100,
          isCurrentlyActive: true
        }
      ];
      
      return res.status(200).json({
        success: true,
        count: demoOffers.length,
        total: demoOffers.length,
        page: Number(page),
        limit: Number(limit),
        data: demoOffers,
        demo: true
      });
    }

    res.status(200).json({
      success: true,
      count: itemsWithStatus.length,
      total,
      page: Number(page),
      limit: Number(limit),
      data: itemsWithStatus
    });
  } catch (error) {
    console.error('Error fetching guest offers:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
