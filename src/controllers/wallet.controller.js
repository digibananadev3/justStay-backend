import WalletTransaction from "../models/walletTransaction.model.js";
import mongoose from "mongoose";





// ======================================================
// 💼 GET WALLET BALANCE
// ======================================================
export const getWalletBalance = async (req, res) => {
  try {
    const lastTxn = await WalletTransaction.findOne({
      userId: req.userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      balance: lastTxn ? lastTxn.balanceAfter : 0,
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
      userId: req.userId,
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
      userId: req.userId,
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
          userId: req.userId,
          type: "DEBIT",
          source: "WITHDRAWAL",
          amount,
          balanceAfter: newBalance,
          status: "pending",
        },
      ],
      { session }
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