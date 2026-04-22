import express from "express";
import {
  register,
  login,
  resendOtp,
  verifyOtp,
  googleLogin,
  facebookLogin,
  completeUserProfile,
  getUserProfile,
  submitKyc,
  reviewKyc,
  finaliseKyc,
  submitBankDetails,
  verifyBankDetails,
  getKycStatus,
  getUserConfidentialInfo,
  getPendingKycList,
  getPendingBankList,
  generateReferralCodeIfNotController,
  adminLogin,
  verifyAdminOtp
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { role } from "../middlewares/role.middleware.js";
const router = express.Router();

// Public routes
router.post("/register", register);        // Register user
router.post("/login", login);              // Login with email/phone + password
router.post("/resend-otp", resendOtp);        // Send OTP to phone
router.post("/verify-otp", verifyOtp);    // Verify OTP login

// Admin Login
router.post("/admin/login", adminLogin);
router.post("/admin/verifyAdminOtp", verifyAdminOtp);

router.post("/google", googleLogin);      // Login with Google OAuth
router.post("/facebook-login", facebookLogin);

router.patch("/update-profile/:userId", completeUserProfile); // Update user profile (protected route)
router.get("/user/:userId", getUserProfile); // Get user profile (protected route)
// Protected routes (JWT required)
// router.get("/me", protect, getMe);        // Get current logged-in user
// router.post("/logout", protect, logout);  // Logout (frontend just deletes token)


// kyc.routes.js
router.post("/submit", submitKyc);
router.put("/:userId/review", reviewKyc);
router.get("/admin/kyc/pending", protect, role("admin"), getPendingKycList);
router.put("/user/:userId/finalise", finaliseKyc);
router.post("/bank/submit", submitBankDetails);
router.get("/admin/bank/pending", protect, role("admin"), getPendingBankList);
router.put("/user/:userId/bank/verify", verifyBankDetails);
router.get("/:userId/status", getKycStatus);


// GET Referral Code and User name
router.get("/user/:userId/generate-referral", generateReferralCodeIfNotController)


// CONFIDENTIAL INFO ROUTE
router.get("/user/:userId/private/data", getUserConfidentialInfo);

export default router;
