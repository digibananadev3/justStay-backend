import express from "express";
import {
  register,
  login,
  resendOtp,
  verifyOtp,
  googleLogin,
  facebookLogin
} from "../controllers/auth.controller.js";
const router = express.Router();

// Public routes
router.post("/register", register);        // Register user
router.post("/login", login);              // Login with email/phone + password
router.post("/resend-otp", resendOtp);        // Send OTP to phone
router.post("/verify-otp", verifyOtp);    // Verify OTP login

router.post("/google", googleLogin);      // Login with Google OAuth
router.post("/facebook-login", facebookLogin);

// Protected routes (JWT required)
// router.get("/me", protect, getMe);        // Get current logged-in user
// router.post("/logout", protect, logout);  // Logout (frontend just deletes token)

export default router;
