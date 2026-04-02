import mongoose from "mongoose";
import RoomBooking from "../../models/roomBooking.model.js";
import Settlement from "../../models/settlement.model.js";
import User from "../../models/user.model.js";
import PropertyInfo from "../../models/property.model.js";

const startOfDayUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
const endOfDayUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

export const getAdminOverview = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(now.getUTCDate() - 6);
    const start = startOfDayUTC(sevenDaysAgo);
    const end = endOfDayUTC(now);

    const [totalBookings, totalRevenueDoc, activeUsers, pendingVerifications] = await Promise.all([
      RoomBooking.countDocuments({}),
      Settlement.aggregate([
        { $group: { _id: null, sum: { $sum: "$amount" } } },
      ]),
      User.countDocuments({ isActive: true }),
      PropertyInfo.countDocuments({ "verification.status": { $in: ["Pending", "InReview"] } }),
    ]);

    const totalRevenue = totalRevenueDoc?.[0]?.sum || 0;

    // Revenue trends for last 7 days (using settlements as proxy)
    const trendsRows = await Settlement.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, total: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ]);
    const trendMap = new Map(trendsRows.map((r) => [r._id, r.total]));
    const trend = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      trend.push({ date: key, amount: trendMap.get(key) || 0 });
    }

    // Quick actions
    const [withdrawalRequests, failedBookings, newHotelListings] = await Promise.all([
      Settlement.countDocuments({ status: { $in: ["pending", "processing"] } }),
      RoomBooking.countDocuments({ status: { $in: ["Failed", "Cancel", "Cancelled"] } }),
      PropertyInfo.countDocuments({ createdAt: { $gte: startOfDayUTC(new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)) } }),
    ]);

    // Recent activity: last 6 events from bookings/settlements/properties
    const [recentBookings, recentSettlements, recentProperties] = await Promise.all([
      RoomBooking.find({}).sort({ createdAt: -1 }).limit(3).select("_id status priceSummary createdAt"),
      Settlement.find({}).sort({ createdAt: -1 }).limit(2).select("_id status amount createdAt"),
      PropertyInfo.find({}).sort({ createdAt: -1 }).limit(1).select("_id basicPropertyDetails.name createdAt")
    ]);
    const recentActivity = [
      ...recentBookings.map((b) => ({ type: "booking", id: b._id, status: b.status || "Created", amount: b.priceSummary?.totalPaid || 0, createdAt: b.createdAt })),
      ...recentSettlements.map((s) => ({ type: "settlement", id: s._id, status: s.status, amount: s.amount, createdAt: s.createdAt })),
      ...recentProperties.map((p) => ({ type: "property", id: p._id, title: p.basicPropertyDetails?.name, status: "New", createdAt: p.createdAt })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // KPI tiles
    const hourlyBookings = await RoomBooking.countDocuments({ bookingType: { $in: ["Hourly", "hourly"] } }).catch(() => 0);
    const goLiveHotels = await PropertyInfo.countDocuments({ "verification.status": "Approved" }).catch(() => 0);
    const avgCommission = 12.5; // placeholder unless commission model exists

    res.status(200).json({
      success: true,
      data: {
        header: {
          totalBookings,
          totalRevenue,
          activeUsers,
          pendingVerifications,
        },
        revenueTrends: {
          period: { from: start, to: end },
          interval: "daily",
          series: trend,
          averageDaily: Math.round(trend.reduce((a, b) => a + b.amount, 0) / trend.length || 0),
          peakDay: trend.reduce((p, c) => (c.amount > p.amount ? c : p), { date: null, amount: 0 }),
          total7Days: trend.reduce((a, b) => a + b.amount, 0),
        },
        quickActions: {
          pendingVerifications,
          withdrawalRequests,
          failedBookings,
          newHotelListings,
        },
        recentActivity,
        kpis: {
          hourlyBookings,
          goLiveHotels,
          avgCommission,
        },
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
