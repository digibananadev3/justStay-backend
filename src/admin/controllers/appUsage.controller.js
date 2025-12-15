import AppUsage from '../../models/appUsage.model.js';
import User from '../../models/user.model.js';
import { subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * @desc    Get app usage summary for a guest
 * @route   GET /api/admin/guests/:id/app-usage/summary
 * @access  Private/Admin
 */
export const getGuestAppUsageSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);

    // Get total sessions count
    const [totalSessions, sessions7Days, sessions30Days] = await Promise.all([
      AppUsage.countDocuments({ userId: user._id }),
      AppUsage.countDocuments({ 
        userId: user._id, 
        startTime: { $gte: sevenDaysAgo } 
      }),
      AppUsage.countDocuments({ 
        userId: user._id, 
        startTime: { $gte: thirtyDaysAgo } 
      })
    ]);

    // Get average session duration
    const durationStats = await AppUsage.aggregate([
      { $match: { userId: user._id, duration: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: "$duration" },
          maxDuration: { $max: "$duration" },
          minDuration: { $min: "$duration" }
        }
      }
    ]);

    // Get most used screens/features
    const mostUsedScreens = await AppUsage.aggregate([
      { $match: { userId: user._id } },
      { $unwind: "$screens" },
      {
        $group: {
          _id: "$screens.name",
          totalDuration: { $sum: "$screens.duration" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalDuration: -1 } },
      { $limit: 5 }
    ]);

    // Get device distribution
    const deviceDistribution = await AppUsage.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: "$deviceInfo.platform",
          count: { $sum: 1 },
          percentage: { $avg: 1 }
        }
      },
      { 
        $project: {
          _id: 0,
          platform: "$_id",
          count: 1,
          percentage: { $multiply: ["$percentage", 100] }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get usage trend (last 7 days)
    const usageTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const start = startOfDay(date);
      const end = endOfDay(date);
      
      const daySessions = await AppUsage.countDocuments({
        userId: user._id,
        startTime: { $gte: start, $lte: end }
      });

      usageTrend.push({
        date: start.toISOString().split('T')[0],
        sessions: daySessions
      });
    }

    // Prepare response
    const response = {
      summary: {
        totalSessions,
        sessions7Days,
        sessions30Days,
        avgSessionDuration: durationStats[0]?.avgDuration ? Math.round(durationStats[0].avgDuration) : 0,
        maxSessionDuration: durationStats[0]?.maxDuration || 0,
        minSessionDuration: durationStats[0]?.minDuration || 0,
        lastActive: (await AppUsage.findOne({ userId: user._id })
          .sort({ endTime: -1 })
          .select('endTime'))?.endTime || null
      },
      mostUsedScreens: mostUsedScreens.map(screen => ({
        name: screen._id,
        duration: screen.totalDuration,
        count: screen.count
      })),
      deviceDistribution,
      usageTrend
    };

    // If no data, return demo data
    if (totalSessions === 0) {
      response.demo = true;
      response.summary = {
        totalSessions: 42,
        sessions7Days: 12,
        sessions30Days: 42,
        avgSessionDuration: 325,
        maxSessionDuration: 1280,
        minSessionDuration: 45,
        lastActive: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
      };
      response.mostUsedScreens = [
        { name: 'Home', duration: 4560, count: 15 },
        { name: 'Search', duration: 3240, count: 12 },
        { name: 'Property Details', duration: 2870, count: 8 },
        { name: 'Bookings', duration: 1840, count: 5 },
        { name: 'Profile', duration: 920, count: 2 }
      ];
      response.deviceDistribution = [
        { platform: 'android', count: 28, percentage: 66.67 },
        { platform: 'ios', count: 12, percentage: 28.57 },
        { platform: 'web', count: 2, percentage: 4.76 }
      ];
      response.usageTrend = Array(7).fill().map((_, i) => ({
        date: subDays(now, 6 - i).toISOString().split('T')[0],
        sessions: Math.floor(Math.random() * 10) + 1
      }));
    }

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    console.error('Error fetching app usage summary:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * @desc    Get detailed app usage logs for a guest
 * @route   GET /api/admin/guests/:id/app-usage/logs
 * @access  Private/Admin
 */
export const getGuestAppUsageLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate,
      platform,
      minDuration,
      maxDuration
    } = req.query;

    const user = await User.findOne({ _id: id, role: "customer" }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "Guest not found" });

    const skip = (Number(page) - 1) * Number(limit);
    const query = { userId: user._id };

    // Apply filters
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    if (platform) {
      query['deviceInfo.platform'] = platform;
    }

    if (minDuration || maxDuration) {
      query.duration = {};
      if (minDuration) query.duration.$gte = Number(minDuration);
      if (maxDuration) query.duration.$lte = Number(maxDuration);
    }

    // Get paginated results
    const [items, total] = await Promise.all([
      AppUsage.find(query)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-__v -updatedAt')
        .lean(),
      AppUsage.countDocuments(query)
    ]);

    // If no logs found, return demo data
    if (items.length === 0) {
      const demoLogs = Array(5).fill().map((_, i) => ({
        _id: `demo_${i}`,
        userId: user._id,
        sessionId: `session_${Date.now()}_${i}`,
        deviceInfo: {
          platform: ['android', 'ios', 'web'][Math.floor(Math.random() * 3)],
          osVersion: '15.2.1',
          appVersion: '2.3.0',
          deviceModel: 'iPhone 13 Pro'
        },
        startTime: subDays(new Date(), i).toISOString(),
        endTime: subDays(new Date(), i - 0.5).toISOString(),
        duration: Math.floor(Math.random() * 1000) + 60,
        screens: [
          { name: 'Home', startTime: subDays(new Date(), i), endTime: subDays(new Date(), i - 0.1), duration: 120 },
          { name: 'Search', startTime: subDays(new Date(), i - 0.1), endTime: subDays(new Date(), i - 0.2), duration: 180 }
        ],
        actions: [
          { type: 'screen_view', name: 'Home', timestamp: subDays(new Date(), i) },
          { type: 'button_click', name: 'Search', timestamp: subDays(new Date(), i - 0.1) }
        ],
        networkType: ['wifi', 'cellular'][Math.floor(Math.random() * 2)],
        appState: {
          isBackground: false,
          isActive: true
        },
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        location: {
          type: 'Point',
          coordinates: [
            72.8777 + (Math.random() * 0.1 - 0.05), // Mumbai coordinates with some randomness
            19.0760 + (Math.random() * 0.1 - 0.05)
          ]
        },
        lastActive: subDays(new Date(), i - 0.1).toISOString(),
        createdAt: subDays(new Date(), i).toISOString(),
        demo: true
      }));

      return res.status(200).json({
        success: true,
        count: demoLogs.length,
        total: demoLogs.length,
        page: Number(page),
        limit: Number(limit),
        data: demoLogs,
        demo: true
      });
    }

    res.status(200).json({
      success: true,
      count: items.length,
      total,
      page: Number(page),
      limit: Number(limit),
      data: items
    });
  } catch (error) {
    console.error('Error fetching app usage logs:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
