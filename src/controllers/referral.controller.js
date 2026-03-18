import Referral from "../models/referral.model.js";
import User from "../models/user.model.js";
import WalletTransaction from "../models/walletTransaction.model.js";
import mongoose from "mongoose";



// ======================================================
// REWARD PERCENTAGES PER LEVEL
// ======================================================
const REWARD_PERCENTS = {
  1: 5, // Level 1 → 5% of booking amount
  2: 3, // Level 2 → 3%
  3: 2, // Level 3 → 2%
  4: 1, // Level 4 → 1%
};


// ======================================================
// 🔁 DISTRIBUTE REFERRAL REWARDS  (called inside createRoomBooking)
// ======================================================
export const distributeReferralRewards = async (
  userId,
  bookingId,
  bookingAmount,
  session
) => {
  try {
    const user = await User.findById(userId).session(session);

    if (!user?.referralPath?.length) return;

const maxLevel = 4;
    for (let i = 0; i <  Math.min(user.referralPath.length, maxLevel); i++) {
      const level = i + 1;
      const referrerId = user.referralPath[i];
      const rewardAmount = parseFloat(
        ((bookingAmount * REWARD_PERCENTS[level]) / 100).toFixed(2)
      );

      // Create referral reward record
      await Referral.create(
        [
          {
            referrerId,
            refereeId: userId,
            level,
            bookingId,
            rewardAmount,
            status: "paid",
            paidAt: new Date(),
          },
        ],
        { session }
      );

      // Credit wallet transaction
      await WalletTransaction.create(
        [
          {
            userId: referrerId,
            type: "CREDIT",
            amount: rewardAmount,
            description: `Level ${level} referral reward`,
            status: "completed",
            bookingId,
          },
        ],
        { session }
      );

      // Increment wallet balance on user
      await User.findByIdAndUpdate(
        referrerId,
        { $inc: { walletBalance: rewardAmount } },
        { session }
      );
    }
  } catch (error) {
    // Don't throw — reward failure should not block booking
    console.error("Referral reward distribution failed:", error.message);
  }
};



//  ========================================================
//     Apply Referral Code
//  ========================================================
export const applyReferralCode = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.userId;   // from middleware
    const { referralCode } = req.body;


    if (!referralCode) {
      return res.status(400).json({ message: "Referral code is required" });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Allow only once
    if (user.referredBy) {
      return res.status(400).json({ message: "Referral already applied" });
    }

    // Admin restriction
    if (user.role === "admin") {
      return res.status(400).json({ message: "Admins cannot apply referral" });
    }

    const referrer = await User.findOne({ referralCode }).session(session);
    if (!referrer) {
      return res.status(400).json({ message: "Invalid referral code" });
    }

    // Prevent self referral
    if (referrer._id.toString() === user._id.toString()) {
      return res.status(400).json({
        message: "You cannot use your own referral code",
      });
    }

    // Prevent circular referral (proper ObjectId check)
    if (
      referrer.referralPath?.some(
        (id) => id.toString() === user._id.toString()
      )
    ) {
      return res.status(400).json({
        message: "Circular referral detected",
      });
    }

    // Build 4-level path
    let referralPath = [referrer._id];

    if (referrer.referralPath?.length > 0) {
      referralPath = [
        ...referralPath,
        ...referrer.referralPath.slice(0, 3),
      ];
    }

    // Update current user
    user.referredBy = referrer._id;
    user.referralPath = referralPath;

    await user.save({ session });

    // Update upline stats
    for (let i = 0; i < referralPath.length; i++) {
      const level = i + 1;

      await User.updateOne(
        { _id: referralPath[i] },
        {
          $inc: {
            [`referralStats.level${level}Count`]: 1,
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Referral applied successfully",
      data: {
        referredBy: referrer._id,
        referralPath,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ======================================================
// 🌳 GET REFERRAL TREE
// ======================================================
// export const getReferralTree = async (req, res) => {
//   try {
//     const userId = req.user.userId;

//     const referrals = await User.find({
//       referralPath: userId,
//     })
//       .select("firstName lastName referralPath")
//       .lean();

//     const formatted = referrals.map((user) => {
//       const levelIndex = user.referralPath.findIndex(
//         (id) => id.toString() === userId.toString()
//       );

//       return {
//         firstName: user.firstName,
//         lastName: user.lastName,
//         level: levelIndex + 1,
//       };
//     });

//     res.status(200).json({
//       success: true,
//       count: formatted.length,
//       data: formatted,
//     });

//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
export const getReferralTree = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const referrals = await User.find({
      referralPath: userId,
    }).select("firstName lastName referralCode referralPath");

    const formatted = referrals.map(user => ({
      id: user._id,
      name: user.firstName + " " + user.lastName,
      level: user.referralPath.indexOf(userId) + 1
    }));

    res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ======================================================
// 📊 GET REFERRAL STATS
// ======================================================
export const getReferralStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const referrals = await User.find({
      referralPath: userId,
    })
      .select("referralPath")
      .lean();

    const stats = {
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
    };

    referrals.forEach((user) => {
      const levelIndex = user.referralPath.findIndex(
        (id) => id.toString() === userId.toString()
      );

      if (levelIndex !== -1) {
        stats[`level${levelIndex + 1}`]++;
      }
    });

    res.status(200).json({
      success: true,
      data: stats,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// ======================================================
// 💰 GET EARNINGS SUMMARY
// ======================================================
export const getEarningsSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const total = await WalletTransaction.aggregate([
      { $match: { userId, type: "CREDIT", status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const monthly = await WalletTransaction.aggregate([
      {
        $match: {
          userId,
          type: "CREDIT",
          status: "completed",
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEarned: total[0]?.total || 0,
        thisMonth: monthly[0]?.total || 0,
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// ======================================================
// 🏆 GET LEADERBOARD
// ======================================================
export const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await WalletTransaction.aggregate([
      { $match: { type: "CREDIT", status: "completed" } },
      {
        $group: {
          _id: "$userId",
          totalEarned: { $sum: "$amount" },
        },
      },
      { $sort: { totalEarned: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          totalEarned: 1,
          "user.firstName": 1,
          "user.lastName": 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: leaderboard,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};