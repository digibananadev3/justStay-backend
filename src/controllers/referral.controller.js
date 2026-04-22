import Referral from "../models/referral.model.js";
import User from "../models/user.model.js";
import WalletTransaction from "../models/walletTransaction.model.js";
import mongoose from "mongoose";

// ======================================================
// REWARD PERCENTAGES PER LEVEL
// ======================================================
const REWARD_PERCENTS = {
  1: 5, // Level 1 → 5% of booking amount
  2: 1, // Level 2 → 1%
  3: 1, // Level 3 → 1%
  4: 1, // Level 4 → 1%
};



// ======================================================
// 🔁 DISTRIBUTE REFERRAL REWARDS
// Scenario: E→D→C→B→A, booking made by A
// A's referralPath: [B, C, D, E]
// B gets level1 (5%), C gets level2 (1%), D gets level3 (1%), E gets level4 (1%)
// ======================================================
export const distributeReferralRewards = async (
  userId,
  bookingId,
  bookingAmount,
  session
) => {
  if (!session) throw new Error("Session is required for referral rewards");

  const user = await User.findById(userId).session(session);

  if (!user?.referralPath?.length) {
    console.log("No referral path, skipping rewards");
    return;
  }

  // Cap at 4 levels
  const uplines = user.referralPath.slice(0, 4);

  console.log(`Processing rewards for booking by ${userId}`);
  console.log(`Upline chain (level 1→${uplines.length}):`, uplines);

  for (let i = 0; i < uplines.length; i++) {
    const level = i + 1;         // 1-based level
    const referrerId = uplines[i];
    const percent = REWARD_PERCENTS[level];

    const rewardAmount = parseFloat(
      ((bookingAmount * percent) / 100).toFixed(2)
    );

    if (rewardAmount <= 0) {
      console.log(`Level ${level}: reward is 0, skipping`);
      continue;
    }

    console.log(`Level ${level}: ${referrerId} gets ${percent}% = ₹${rewardAmount}`);

    try {
      // ── Upsert referral record (duplicate-safe) ──────────────────────
      const result = await Referral.updateOne(
        { referrerId, refereeId: userId, bookingId, level },
        {
          $setOnInsert: {
            referrerId,
            refereeId: userId,
            bookingId,
            level,
            rewardAmount,
            status: "Active",
          },
        },
        { upsert: true, session }
      );

      // Already rewarded for this booking+level → skip
      if (result.upsertedCount === 0) {
        console.log(`⏭️ Duplicate reward skipped — level ${level}`);
        continue;
      }

      // ── Get referrer's current wallet balance ─────────────────────────
      const lastTxn = await WalletTransaction.findOne({ userId: referrerId })
        .sort({ createdAt: -1 })
        .session(session);

      const currentBalance = lastTxn?.balanceAfter || 0;
      const newBalance = parseFloat((currentBalance + rewardAmount).toFixed(2));

      // ── Create wallet transaction ─────────────────────────────────────
      await WalletTransaction.create(
        [
          {
            userId: referrerId,
            type: "CREDIT",
            source: `REFERRAL_LEVEL_${level}`,
            amount: rewardAmount,
            balanceAfter: newBalance,
            status: "completed",
            bookingId,
          },
        ],
        { session }
      );

      // ── Update referrer's wallet summary ──────────────────────────────
      await User.findByIdAndUpdate(
        referrerId,
        {
          $inc: {
            "wallet.balance": rewardAmount,
            "wallet.totalEarned": rewardAmount,
            "referralStats.totalEarnings": rewardAmount,
          },
        },
        { session }
      );

      console.log(`✅ Level ${level} reward ₹${rewardAmount} credited to ${referrerId}`);

    } catch (err) {
      console.error(`❌ Failed reward for level ${level}:`, err.message);
      throw err; // keep transaction atomic
    }
  }
};



// ======================================================
// 🔗 APPLY REFERRAL CODE
// Builds referralPath correctly for up to 4 levels:
//
// When C applies B's code, and B's path is [A]:
//   C's path = [B, A]          ← B is level1, A is level2
//
// When D applies C's code, and C's path is [B, A]:
//   D's path = [C, B, A]       ← C=L1, B=L2, A=L3
//
// When E applies D's code, and D's path is [C, B, A]:
//   E's path = [D, C, B, A]    ← D=L1, C=L2, B=L3, A=L4
// ======================================================
export const applyReferralCode = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.body.userId;
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ message: "Referral code is required" });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.referredBy) {
      return res.status(400).json({ message: "Referral already applied" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admins cannot apply referral" });
    }

    const referrer = await User.findOne({ referralCode }).session(session);
    if (!referrer) {
      return res.status(400).json({ message: "Invalid referral code" });
    }

    // ── Self-referral check ───────────────────────────────────────────
    if (referrer._id.toString() === user._id.toString()) {
      return res.status(400).json({ message: "You cannot use your own referral code" });
    }

    // ── Circular referral check ───────────────────────────────────────
    // e.g. A tries to apply B's code but B is already under A
    const isCircular = referrer.referralPath?.some(
      (id) => id.toString() === user._id.toString()
    );
    if (isCircular) {
      return res.status(400).json({ message: "Circular referral detected" });
    }

    // ── Build referralPath (max 4 levels) ─────────────────────────────
    // [referrer, ...referrer's uplines] capped at 4
    const referralPath = [
      referrer._id,
      ...(referrer.referralPath || []),
    ].slice(0, 4);

    // ── Save to user ──────────────────────────────────────────────────
    user.referredBy = referrer._id;
    user.referralPath = referralPath;
    await user.save({ session });

    // ── Increment level count for each upline ─────────────────────────
    for (let i = 0; i < referralPath.length; i++) {
      const level = i + 1;
      await User.updateOne(
        { _id: referralPath[i] },
        { $inc: { [`referralStats.level${level}Count`]: 1 } },
        { session }
      );
    }

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Referral applied successfully",
      data: { referredBy: referrer._id, referralPath },
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
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
    const userId = req.params.userId;

    const referrals = await User.find({
      referralPath: userId,
    }).select("firstName lastName referralCode referralPath wallet");

    const formatted = referrals.map((user) => ({
      id: user._id,
      name: user.firstName + " " + user.lastName,
      level: user.referralPath.indexOf(userId) + 1,
    }));

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
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
    const userId = req.params.userId;

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
        (id) => id.toString() === userId.toString(),
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
