import WalletTransaction from "../models/walletTransaction.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

// ======================================================
// 💰 GET TOTAL PAYOUT
// ======================================================
export const getTotalPayout = async (req, res) => {
  try {
    const result = await WalletTransaction.aggregate([
      { $match: { type: "CREDIT", status: "completed" } },
      { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
    ]);

    res.status(200).json({
      success: true,
      totalPaid: result[0]?.totalPaid || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 📊 LEVEL-WISE STATS
// ======================================================
export const getLevelWiseStats = async (req, res) => {
  try {
    const result = await WalletTransaction.aggregate([
      { $match: { type: "CREDIT", status: "completed" } },
      {
        $group: {
          _id: "$source",
          total: { $sum: "$amount" },
        },
      },
    ]);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 🔒 FREEZE USER
// ======================================================
export const freezeUser = async (req, res) => {
  try {
    const { userId, freeze } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isFrozen: freeze },
      { new: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: `User ${freeze ? "frozen" : "unfrozen"} successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 🚨 FRAUD MONITORING
// ======================================================
export const fraudMonitoring = async (req, res) => {
  try {
    const suspicious = await WalletTransaction.aggregate([
      {
        $group: {
          _id: "$userId",
          totalTransactions: { $sum: 1 },
          totalEarned: { $sum: "$amount" },
        },
      },
      { $match: { totalTransactions: { $gt: 100 } } },
      { $sort: { totalEarned: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: suspicious,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
