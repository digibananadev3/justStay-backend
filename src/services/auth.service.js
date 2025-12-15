import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// -----------------------------
// Generate JWT token
// -----------------------------
export const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// -----------------------------
// Register user
// -----------------------------
export const registerUser = async ({ firstName, lastName, email, phone, password, role }) => {
  // Check if email or phone already exists
  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    const err = new Error("Email or phone already exists");
    err.statusCode = 400;
    throw err;
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password,
    role: role || "customer",
  });

  const token = generateToken(user._id, user.role);

  return {
    user: sanitizeUser(user),
    token,
  };
};

// -----------------------------
// Login user with email/phone + password
// -----------------------------
export const loginUser = async ({ email, phone, password }) => {
  const user = await User.findOne({
    $or: [{ email }, { phone }],
  }).select("+password");

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  if (!user.password) {
    const err = new Error("User has no password, use OTP login");
    err.statusCode = 400;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    throw err;
  }

  const token = generateToken(user._id, user.role);

  return {
    user: sanitizeUser(user),
    token,
  };
};

// -----------------------------
// Send OTP to phone
// -----------------------------
export const sendOtpToPhone = async (phone) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

  let user = await User.findOne({ phone });

  if (!user) {
    user = await User.create({
      firstName: "Guest",
      lastName: "User",
      email: `${phone}@tempuser.com`,
      phone,
      role: "customer",
      otp,
      otpExpiry,
    });
  } else {
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
  }

  // TODO: Integrate SMS service here (Twilio, Fast2SMS)
  console.log(`📱 OTP for ${phone}: ${otp}`);

  return { message: "OTP sent successfully" };
};

// -----------------------------
// Verify OTP
// -----------------------------
export const verifyOtp = async ({ phone, otp }) => {
  const user = await User.findOne({ phone }).select("+otp +otpExpiry");

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  if (!user.otp || user.otp !== otp) {
    const err = new Error("Invalid OTP");
    err.statusCode = 400;
    throw err;
  }

  if (user.otpExpiry < new Date()) {
    const err = new Error("OTP expired");
    err.statusCode = 400;
    throw err;
  }

  user.otp = null;
  user.otpExpiry = null;
  user.isVerified = true;
  await user.save();

  const token = generateToken(user._id, user.role);

  return {
    user: sanitizeUser(user),
    token,
  };
};

// -----------------------------
// Helper: Remove sensitive fields
// -----------------------------
const sanitizeUser = (user) => {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    status: user.status,
  };
};
