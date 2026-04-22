import express from "express";
import { getPendingWithdrawals, getTransactionHistory, getUserWithdrawals, getWalletBalance, processWithdrawal, requestWithdrawal } from "../controllers/wallet.controller.js";
import { protect } from "../middlewares/auth.middleware.js";


const router = express.Router();

// ======================================================
// 💼 GET WALLET BALANCE
// ======================================================
router.get("/user/:userId/balance", getWalletBalance);

// ======================================================
// 📜 GET TRANSACTION HISTORY
// ======================================================
router.get("/user/:userId/transactions", getTransactionHistory);

// ======================================================
// 💸 REQUEST WITHDRAWAL
// ======================================================
router.post("/user/:userId/withdraw", requestWithdrawal);



router.get("/user/:userId/withdrawals", getUserWithdrawals);

// Admin routes
router.get("/admin/withdrawals/pending", protect, getPendingWithdrawals);
router.patch("/admin/withdrawals/:transactionId", protect, processWithdrawal);

export default router;