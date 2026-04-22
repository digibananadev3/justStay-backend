import WalletTransaction from "../models/walletTransaction.model.js";

import User from "../models/user.model.js";
import mongoose from "mongoose";

// ======================================================
// 💼 GET WALLET BALANCE
// ======================================================
export const getWalletBalance = async (req, res) => {
  try {
    const lastTxn = await WalletTransaction.findOne({
      userId: req.params.userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const balance = lastTxn?.balanceAfter || 0;

    res.status(200).json({
      success: true,
      balance: balance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 📜 GET TRANSACTION HISTORY
// ======================================================
export const getTransactionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const transactions = await WalletTransaction.find({
      userId: req.params.userId,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// 💸 REQUEST WITHDRAWAL
// ======================================================
export const requestWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    const lastTxn = await WalletTransaction.findOne({
      userId: req.params.userId,
    })
      .sort({ createdAt: -1 })
      .session(session);

    const currentBalance = lastTxn ? lastTxn.balanceAfter : 0;

    if (currentBalance < amount) {
      throw new Error("Insufficient balance");
    }

    const newBalance = currentBalance - amount;

    await WalletTransaction.create(
      [
        {
          userId: req.params.userId,
          type: "DEBIT",
          source: "REFERRAL_LEVEL_1",
          amount,
          balanceAfter: newBalance,
          status: "pending",
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Withdrawal request submitted",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
};

// ======================================================
// 🔍 ADMIN — GET ALL PENDING WITHDRAWAL REQUESTS
// ======================================================
export const getPendingWithdrawals = async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const userId = req.user.userId;

    const user = await User.findById(userId);

    if (user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    // ✅ Fetch withdrawals
    const withdrawals = await WalletTransaction.find({
      type: "DEBIT",
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "userId",
        select: "firstName lastName email phone bankDetails wallet",
      });

    // ✅ Format response
    const formattedData = withdrawals.map((txn) => {
      const user = txn.userId;

      return {
        userId: user?._id,

        // 👤 User Info
        name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
        email: user?.email,
        phone: user?.phone,

        // 🏦 Bank Details
        bank: {
          accountNumber: user?.bankDetails?.accountNumber
            ? `XXXX${user.bankDetails.accountNumber.slice(-4)}`
            : null,
          ifsc: user?.bankDetails?.ifscCode,
          bankName: user?.bankDetails?.bankName,
          status: user?.bankDetails?.status,
        },

        // 💰 Wallet Info
        wallet: {
          balance: user?.wallet?.balance || 0,
          totalWithdrawn: user?.wallet?.totalWithdrawn || 0,
        },

        transactionId: txn?._id,

        // 💸 Withdrawal Info
        withdrawal: {
          amount: txn.amount,
          currency: txn.currency,
          status: txn.status,
          createdAt: txn.createdAt,
        },
      };
    });

    // ✅ Total count
    const total = await WalletTransaction.countDocuments({
      type: "DEBIT",
      status: "pending",
    });

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: formattedData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// ✅ ADMIN — APPROVE OR REJECT WITHDRAWAL REQUEST
// ======================================================
export const processWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transactionId } = req.params;
    const { action, note } = req.body;

    if (!["approve", "reject"].includes(action)) {
      throw new Error("Invalid action");
    }

    // ✅ Admin check
    const admin = await User.findById(req.user.userId).session(session);
    if (admin?.role !== "admin") {
      throw new Error("Unauthorized");
    }

    // ✅ Atomic lock
    const txn = await WalletTransaction.findOneAndUpdate(
      {
        _id: transactionId,
        type: "DEBIT",
        status: { $in: ["pending", "processing"] },
      },
      { $set: { status: "processing" } },
      { new: true, session }
    );

    if (!txn) throw new Error("Transaction not found");

    const user = await User.findById(txn.userId).session(session);
    if (!user) throw new Error("User not found");

    const userWallet = await WalletTransaction.findOne({userId: user._id, type: "CREDIT"});
    const userWalletBalance = userWallet?.amount;

    if (action === "approve") {
      if (userWalletBalance < txn.amount) {
        throw new Error("Insufficient balance");
      }

      user.wallet.balance -= txn.amount;
      user.wallet.totalWithdrawn += txn.amount;

      txn.status = "completed";
      txn.note = note || "Approved by admin";
    }

    if (action === "reject") {
      if (txn.isAmountDeducted) {
        user.wallet.balance += txn.amount;
      }

      txn.status = "failed";
      txn.note = note || "Rejected by admin";

      await WalletTransaction.create(
        [
          {
            userId: txn.userId,
            type: "REFUND_REVERSAL",
            source: "ADMIN_ADJUSTMENT",
            amount: txn.amount,
            balanceAfter: user.wallet.balance,
            status: "completed",
            note: `Reversal for ${txn._id}`,
          },
        ],
        { session }
      );
    }

    txn.balanceAfter = user.wallet.balance;
    txn.processedBy = req.user.userId;
    txn.processedAt = new Date();

    await txn.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message:
        action === "approve"
          ? "Withdrawal approved successfully"
          : "Withdrawal rejected successfully",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // ✅ safe revert only if stuck
    if (req.params.transactionId) {
      await WalletTransaction.findOneAndUpdate(
        {
          _id: req.params.transactionId,
          status: "processing",
        },
        { status: "pending" }
      );
    }

    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};



// ======================================================
// 📋 GET SPECIFIC USER — ALL WITHDRAWALS
// ======================================================
export const getUserWithdrawals = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // ✅ Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // ✅ Check user exists
    const user = await User.findById(userId).select(
      "firstName lastName email phone wallet bankDetails"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Build filter
    // DEBIT = withdrawal request | REFUND_REVERSAL = rejected reversal credit
    const filter = {
      userId,
      type: { $in: ["DEBIT", "REFUND_REVERSAL"] },
    };

    // Optional: filter by status (pending / completed / failed)
    const allowedStatuses = ["pending", "completed", "failed"];
    if (status && allowedStatuses.includes(status)) {
      filter.status = status;
    }

    const pageNum  = Number(page);
    const limitNum = Number(limit);

    const [withdrawals, total] = await Promise.all([
      WalletTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      WalletTransaction.countDocuments(filter),
    ]);

    // ✅ Summary counts across ALL withdrawals (not just this page)
    const [summary] = await WalletTransaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: "DEBIT",
        },
      },
      {
        $group: {
          _id: null,
          totalRequested:  { $sum: "$amount" },
          totalApproved: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0],
            },
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0],
            },
          },
          totalRejected: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, "$amount", 0],
            },
          },
          countTotal:     { $sum: 1 },
          countApproved:  { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          countPending:   { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          countRejected:  { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        },
      },
    ]);

    // ✅ Format transactions
    const transactions = withdrawals.map((txn) => ({
      transactionId: txn._id,
      type:          txn.type,
      amount:        txn.amount,
      currency:      txn.currency || "INR",
      status:        txn.status,
      balanceAfter:  txn.balanceAfter,
      note:          txn.note || null,
      source:        txn.source || null,
      createdAt:     txn.createdAt,
      // If it's a reversal, reference the original txn note for traceability
      isReversal:    txn.type === "REFUND_REVERSAL",
    }));

    return res.status(200).json({
      success: true,
      // 👤 User snapshot
      user: {
        userId:  user._id,
        name:    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A",
        email:   user.email  || null,
        phone:   user.phone  || null,
        wallet: {
          currentBalance: user.wallet?.balance        || 0,
          totalEarned:    user.wallet?.totalEarned    || 0,
          totalWithdrawn: user.wallet?.totalWithdrawn || 0,
        },
        bank: user.bankDetails?.accountNumber
          ? {
              bankName:      user.bankDetails.bankName,
              accountNumber: `XXXX${user.bankDetails.accountNumber.slice(-4)}`,
              ifscCode:      user.bankDetails.ifscCode,
              accountType:   user.bankDetails.accountType,
              status:        user.bankDetails.status,
            }
          : null,
      },
      // 📊 Aggregated summary
      summary: summary
        ? {
            totalRequested: summary.totalRequested,
            totalApproved:  summary.totalApproved,
            totalPending:   summary.totalPending,
            totalRejected:  summary.totalRejected,
            countTotal:     summary.countTotal,
            countApproved:  summary.countApproved,
            countPending:   summary.countPending,
            countRejected:  summary.countRejected,
          }
        : {
            totalRequested: 0, totalApproved: 0,
            totalPending:   0, totalRejected: 0,
            countTotal:     0, countApproved: 0,
            countPending:   0, countRejected: 0,
          },
      // 📄 Paginated transactions
      pagination: {
        total,
        page:  pageNum,
        pages: Math.ceil(total / limitNum),
        count: transactions.length,
      },
      data: transactions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};