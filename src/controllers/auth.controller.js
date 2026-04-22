import User from "../models/user.model.js";
import PropertyInfo from "../models/property.model.js";
import { verifyGoogleToken } from "../utils/googleVerify.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import axios from "axios";
import crypto from "crypto";
import sendSMS from "../services/sms.service.js";

// ======================================================
// UTILITIES
// ======================================================

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// GeOTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

// Generate unique username and referral
const generateUsernameAndReferral = async (firstName = "", lastName = "") => {
  const cleanFirst = firstName.replace(/\s+/g, "").toUpperCase();
  const cleanLast = lastName.replace(/\s+/g, "").toUpperCase();

  // ✅ Take first 3 letters (fallback if small)
  const part1 = cleanFirst.slice(0, 3) || "USR";
  const part2 = cleanLast.slice(0, 3) || "ACC";

  let username = "";
  let referralCode = "";

  while (true) {
    const randomNum = crypto.randomInt(100000, 999999);

    const base = `${part1}${part2}${randomNum}`;

    username = base.toLowerCase(); // for DB (clean)
    referralCode = base.toUpperCase(); // for sharing

    const exists = await User.findOne({
      $or: [{ username }, { referralCode }],
    });

    if (!exists) break;
  }

  return { username, referralCode };
};

/* ============================================================
   REFERRAL ENGINE (SEPARATE FUNCTION)
============================================================ */
const processReferral = async (referralCode, session) => {
  if (!referralCode) return { referralPath: [], upline: null };

  const referrer = await User.findOne({ referralCode }).session(session);

  if (!referrer) {
    throw new Error("Invalid referral code");
  }

  // Build 4-level path
  let referralPath = [referrer._id];

  if (referrer.referralPath?.length > 0) {
    referralPath = [...referralPath, ...referrer.referralPath.slice(0, 3)];
  }

  return {
    referralPath,
    upline: referrer._id,
  };
};

// ====================================================
// REGISTER
// ====================================================
export const register = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstName, lastName, email, phone, password, role, referralCode } =
      req.body;

    // ✅ Default role for phone-only users
    const userRole = role || "customer";

    const isPhoneOnly = phone && !email;
    const isEmailRegistration = email && password;

    // ===============================
    // VALIDATIONS
    // ===============================
    if (!phone) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Phone number is required" });
    }

    if (!["customer", "hotelier", "admin"].includes(userRole)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Invalid user type",
      });
    }

    if (email && !password) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Password is required for email registration",
      });
    }

    // ===============================
    // CHECK EXISTING USER
    // ===============================
    let user = await User.findOne({ phone }).session(session);

    if (user) {
      const userRoles = user.roles || [user.role];

      // ✅ Add new role if not exists
      if (!userRoles.includes(userRole)) {
        user.roles = [...new Set([...userRoles, userRole])];
        await user.save({ session });
      }

      // ===============================
      // PHONE LOGIN → RESEND OTP
      // ===============================
      if (isPhoneOnly) {
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        const template =
          "<#> {#var#} is your one time password to login in Juststay account. Thanks for using Juststay. Enjoy :-) IQ4cBruoNjH";

        const message = template.replace("{#var#}", otp);

        await sendSMS(user.phone, message);

        return res.status(200).json({
          success: true,
          message: "OTP sent successfully",
        });
      }

      // ===============================
      // EMAIL REGISTRATION FOR EXISTING USER
      // ===============================
      if (isEmailRegistration) {
        if (user.email) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: "User already registered with email",
          });
        }

        user.email = email;
        user.password = password;

        // Generate username + referral if missing
        if (!user.username && firstName && lastName) {
          const generated = await generateUsernameAndReferral(
            firstName,
            lastName,
          );
          user.username = generated.username;
          user.referralCode = generated.referralCode;
        }

        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        const token = generateToken(user._id, userRole);

        return res.status(200).json({
          success: true,
          message: "Account upgraded successfully",
          token,
          data: {
            user: {
              id: user._id,
              phone: user.phone,
              role: user.role,
            },
          },
        });
      }
    }

    // ===============================
    // NEW USER CREATION
    // ===============================
    let username = null;
    let newReferralCode = null;

    if (isEmailRegistration && firstName && lastName) {
      const generated = await generateUsernameAndReferral(firstName, lastName);
      username = generated.username;
      newReferralCode = generated.referralCode;
    }

    // ===============================
    // REFERRAL PROCESSING
    // ===============================
    let referralData = {
      referralPath: [],
      upline: null,
    };

    if (referralCode) {
      referralData = await processReferral(referralCode, session);
    }

    const otp = generateOTP();

    const users = await User.create(
      [
        {
          firstName,
          lastName,
          email,
          phone,
          password: isEmailRegistration ? password : undefined,
          role: userRole,
          roles: [userRole],
          status: "active",

          otp,
          otpExpiry: new Date(Date.now() + 5 * 60 * 1000),

          username,
          referralCode: newReferralCode,

          referredBy: referralData.upline,
          referralPath: referralData.referralPath,
        },
      ],
      { session },
    );

    user = users[0];

    await session.commitTransaction();
    session.endSession();

    const token = generateToken(user._id, user.role);

    // ===============================
    // EMAIL REGISTRATION RESPONSE
    // ===============================
    if (isEmailRegistration) {
      return res.status(201).json({
        success: true,
        message: "User registration successful",
        token,
        data: {
          user: {
            id: user._id,
            phone: user.phone,
            role: user.role,
          },
        },
      });
    }

    // ===============================
    // PHONE REGISTRATION → SEND OTP
    // ===============================
    const template =
      "<#> {#var#} is your one time password to login in Juststay account. Thanks for using Juststay. Enjoy :-) IQ4cBruoNjH";

    const message = template.replace("{#var#}", otp);

    await sendSMS(user.phone, message);

    return res.status(201).json({
      success: true,
      message: "Registration successful. OTP sent",
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          role: user.role,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ===============================
// LOGIN (Email + Password OR Phone + OTP)
// ===============================
export const login = async (req, res) => {
  try {
    const { email, phone, password, role = "" } = req.body;

    const ALLOWED_ROLES = ["customer", "hotelier"];

    // ===============================
    // EMAIL + PASSWORD LOGIN
    // ===============================
    if (email && password) {
      const user = await User.findOne({ email }).select("+password");

      if (!user) return res.status(400).json({ message: "User not found" });

      if (user.provider === "google") {
        return res.status(400).json({
          message: "Use Google Sign-in",
        });
      }

      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(400).json({
          message: "Invalid credentials",
        });
      }

      // ===============================
      // ✅ ROLE HANDLING (SAFE)
      // ===============================
      let userRoles =
        user.roles && user.roles.length ? user.roles : [user.role];

      // 👉 Add role ONLY in roles array
      if (role && ALLOWED_ROLES.includes(role) && !userRoles.includes(role)) {
        userRoles.push(role);
        user.roles = [...new Set(userRoles)];

        // ❌ DO NOT change primary role
        // user.role = role; ❌ NEVER DO THIS

        await user.save();
      }

      // ✅ Active role for session (UI purpose)
      const activeRole = role && user.roles.includes(role) ? role : user.role;

      const token = generateToken(user._id, activeRole);

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: activeRole,
          roles: user.roles,
          username: user.username,
        },
      });
    }

    // ===============================
    // PHONE LOGIN (OTP)
    // ===============================
    if (phone) {
      let user = await User.findOne({ phone });

      // if (!user) return res.status(400).json({ message: "User not found" });
      if (!user) {
        const { referralCode } = await generateUsernameAndReferral("", "");

        const users = await User.create([
          {
            phone,
            role: "customer", // default role
            roles: ["customer"],
            status: "active",
            isVerified: false,

            username: null,
            referralCode: null,
          },
        ]);

        user = users[0];
      }

      if (user.provider === "google") {
        return res.status(400).json({
          message: "Use Google Sign-in",
        });
      }

      // ===============================
      // ✅ ROLE HANDLING (PHONE)
      // ===============================
      let userRoles =
        user.roles && user.roles.length ? user.roles : [user.role];

      if (role && ALLOWED_ROLES.includes(role) && !userRoles.includes(role)) {
        userRoles.push(role);
        user.roles = [...new Set(userRoles)];

        await user.save();
      }

      const activeRole = role && user.roles.includes(role) ? role : user.role;

      const otp = generateOTP();
      user.otp = otp;
      user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      await user.save();

      const template =
        "<#> {#var#} is your one time password to login in Juststay account. Thanks for using Juststay. Enjoy :-) IQ4cBruoNjH";

      const message = template.replace("{#var#}", otp);

      await sendSMS(user.phone, message);

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        // otp, // remove in production
      });
    }

    return res.status(400).json({
      message: "Provide email/password or phone",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ====================================================
// ADMIN LOGIN (Email + Password OR Phone + OTP)
// ====================================================
export const adminLogin = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // ===============================
    // EMAIL + PASSWORD LOGIN
    // ===============================
    if (email && password) {
      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return res.status(400).json({ message: "Admin not found" });
      }

      // ❌ Only admin allowed
      if (user.role !== "admin" && !user.roles?.includes("admin")) {
        return res.status(403).json({
          message: "Access denied. Admin only.",
        });
      }

      if (user.provider === "google") {
        return res.status(400).json({
          message: "Use Google Sign-in",
        });
      }

      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(400).json({
          message: "Invalid credentials",
        });
      }

      const token = generateToken(user._id, "admin");

      return res.status(200).json({
        success: true,
        message: "Admin login successful",
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: "admin",
        },
      });
    }

    // ===============================
    // PHONE LOGIN (OTP)
    // ===============================
    if (phone) {
      const user = await User.findOne({ phone });

      if (!user) {
        return res.status(400).json({
          message: "Admin not found",
        });
      }

      // ❌ Only admin allowed
      if (user.role !== "admin" && !user.roles?.includes("admin")) {
        return res.status(403).json({
          message: "Access denied. Admin only.",
        });
      }

      if (user.provider === "google") {
        return res.status(400).json({
          message: "Use Google Sign-in",
        });
      }

      const otp = generateOTP();

      user.otp = otp;
      user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      await user.save();

      const template =
        "<#> {#var#} is your one time password to login in Juststay account. Thanks for using Juststay. Enjoy :-) IQ4cBruoNjH";

      const message = template.replace("{#var#}", otp);

      await sendSMS(user.phone, message);

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
      });
    }

    return res.status(400).json({
      message: "Provide email/password or phone",
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

export const verifyAdminOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone }).select("+otp +otpExpiry");

    if (!user) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // ❌ Only admin allowed
    if (user.role !== "admin" && !user.roles?.includes("admin")) {
      return res.status(403).json({
        message: "Access denied. Admin only.",
      });
    }

    if (user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const token = generateToken(user._id, "admin");

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Admin OTP Verify Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ====================================================
// @desc    Generate username & referral code if missing
// @route   POST /api/auth/generate-referral
// @access  Private
// ====================================================
export const generateReferralCodeIfNotController = async (req, res) => {
  try {
    const userId = req.params.userId; // from auth middleware

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Already exists → DO NOTHING
    if (user.referralCode && user.username) {
      return res.status(200).json({
        success: true,
        message: "Referral code already exists",
        data: {
          username: user.username,
          referralCode: user.referralCode,
        },
      });
    }

    // ❌ Need name to generate
    if (!user.firstName || !user.lastName) {
      return res.status(400).json({
        success: false,
        message:
          "First name and last name are required to generate referral code",
      });
    }

    const { username, referralCode } = await generateUsernameAndReferral(
      user.firstName,
      user.lastName,
    );

    user.username = username;
    user.referralCode = referralCode;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Referral code generated successfully",
      data: {
        username,
        referralCode,
      },
    });
  } catch (error) {
    console.error("generateReferralCodeIfNotController error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ====================================================
// @desc    Send OTP for phone login / verification
// @route   POST /api/auth/send-otp
// ====================================================
export const resendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res.status(400).json({ message: "Phone number is required" });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    let user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // If user registered via Google, prompt to use Google Sign-in
    if (user.provider === "google") {
      return res.status(400).json({ message: "Use Google Sign-in" });
    }

    // Update user with new OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    let existingUser = await User.findOne({ phone });

    const responseUser = [];

    if (existingUser.role === "hotelier") {
      // const businessDetails = await BusinessDetails.findOne({ where: { userId: user.id } });
      // responseUser.businessDetails = businessDetails || null;
      responseUser.push({
        id: existingUser._id,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        email: existingUser.email,
        phone: existingUser.phone,
        role: existingUser.role,
        otp: existingUser.otp || otp,
        otpExpiry: existingUser.otpExpiry,
        isVerified: existingUser.isVerified,
        status: existingUser.status,
      });
    }

    // 🔔 TODO: Integrate real SMS API here (Twilio, Fast2SMS, etc.)

    // res.status(200).json({ status: "success", message: "OTP sent successfully" });
    res.status(200).json({
      status: "success",
      message: "OTP resent successfully",
      data: responseUser,
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Server error", error: error.message });
  }
};

// ====================================================
// @desc    Verify OTP (Login or Register)
// @route   POST /api/auth/verify-otp
// ====================================================
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const user = await User.findOne({ phone }).select("+otp +otpExpiry");

    if (!user) return res.status(404).json({ message: "User not found" });

    // If user registered via Google, prompt to use Google Sign-in
    if (user.provider === "google") {
      return res.status(400).json({ message: "Use Google Sign-in" });
    }

    if (user.otpExpiry < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    // Verify OTP
    if (user.otp !== otp) {
      return res.status(400).json({
        status: "error",
        message: "Invalid OTP",
      });
    }

    user.otp = null;
    user.otpExpiry = null;
    user.isVerified = true;
    await user.save();

    const token = generateToken(user._id, user.role);
    res.status(200).json({
      data: {
        status: "success",
        message: "OTP verified successfully",
        token: token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          roles: user.roles,
        },
        propertyInfo: await PropertyInfo.findOne({ userId: user?._id }),
      },
      //   token,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ====================================================
//    Google Login
// ====================================================
export const googleLogin = async (req, res) => {
  try {
    const { token, role = "customer" } = req.body;

    const payload = await verifyGoogleToken(token);

    const { sub, email, name, picture } = payload;

    let user = await User.findOne({
      $or: [{ email }, { googleId: sub }],
    });

    if (!user) {
      const { referralCode } = await generateUsernameAndReferral(
        name?.split(" ")[0],
        name?.split(" ")[1],
      );

      user = await User.create({
        firstName: name?.split(" ")[0] || "",
        lastName: name?.split(" ")[1] || "",
        email,
        avatar: picture,
        role,
        roles: [role],
        provider: "google",
        googleId: sub,
        // phone: "0000000000", // dummy required field
        isVerified: true,
        referralCode: referralCode,
      });
    }

    const jwtToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      status: "success",
      token: jwtToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        provider: user.provider,
        referralCode: user.referralCode,
        username: user.username,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Google authentication failed" });
  }
};

// ====================================================
//    Facebook Login
// ====================================================
export const facebookLogin = async (req, res) => {
  try {
    const { accessToken, role = "customer" } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        message: "Facebook access token required",
      });
    }

    // Verify token with Facebook Graph API
    const fbResponse = await axios.get(`https://graph.facebook.com/me`, {
      params: {
        fields: "id,name,email,picture",
        access_token: accessToken,
      },
    });

    const { id, name, email, picture } = fbResponse.data;

    let user = await User.findOne({
      $or: [{ email }, { facebookId: id }],
    });

    if (!user) {
      const { referralCode } = await generateUsernameAndReferral(
        name?.split(" ")[0],
        name?.split(" ")[1],
      );

      user = await User.create({
        firstName: name?.split(" ")[0] || "",
        lastName: name?.split(" ")[1] || "",
        email,
        avatar: picture?.data?.url,
        role,
        roles: [role],
        provider: "facebook",
        facebookId: id,
        isVerified: true,
        referralCode: referralCode,
        username: user.username,
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      success: true,
      message: "Facebook login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        provider: user.provider,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    return res.status(401).json({
      message: "Facebook authentication failed",
    });
  }
};

// ====================================================
// @desc    Complete / update user profile
// @route   PUT /api/auth/complete-profile
// @access  Private (requires JWT)
// ====================================================
export const completeUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId; // set by your protect middleware

    const { firstName, lastName, email, phone, city, avatar } = req.body;

    // At least one field must be provided
    if (!firstName && !lastName && !email && !phone && !city && !avatar) {
      return res.status(400).json({
        status: "error",
        message: "Provide at least one field to update",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Only fill in missing fields — don't overwrite existing ones
    if (firstName && !user.firstName) user.firstName = firstName;
    if (lastName && !user.lastName) user.lastName = lastName;
    if (city && !user.city) user.city = city;
    if (avatar && !user.avatar) user.avatar = avatar;

    // Email — check uniqueness before setting
    if (email && !user.email) {
      const emailTaken = await User.findOne({ email, _id: { $ne: userId } });
      if (emailTaken) {
        return res.status(400).json({
          status: "error",
          message: "Email is already in use by another account",
        });
      }
      user.email = email;
    }

    // Phone — check uniqueness before setting
    if (phone && !user.phone) {
      const phoneTaken = await User.findOne({ phone, _id: { $ne: userId } });
      if (phoneTaken) {
        return res.status(400).json({
          status: "error",
          message: "Phone number is already in use by another account",
        });
      }

      // Validate format (matches your schema regex)
      if (!/^[0-9]{10,15}$/.test(phone)) {
        return res.status(400).json({
          status: "error",
          message: "Please enter a valid phone number",
        });
      }

      user.phone = phone;
    }

    // ✅ AUTO GENERATE referralCode IF NOT EXISTS
    // if (!user.referralCode && user.firstName && user.lastName) {
    //   const { username, referralCode } = await generateUsernameAndReferral(
    //     user.firstName,
    //     user.lastName,
    //   );

    //   user.username = username;
    //   user.referralCode = referralCode;
    // }

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        city: user.city,
        avatar: user.avatar,
        role: user.role,
        isVerified: user.isVerified,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ====================================================
// @desc    Get logged-in user's profile
// @route   GET /api/auth/profile
// @access  Private (requires JWT)
// ====================================================
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId; // set by your protect middleware

    const user = await User.findById(userId).populate(
      "referredBy",
      "firstName lastName referralCode",
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (user.status === "banned") {
      return res.status(403).json({
        status: "error",
        message: "Your account has been banned",
      });
    }

    const propertyInfo =
      user.role === "hotelier"
        ? await PropertyInfo.findOne({ userId: user._id })
        : null;

    return res.status(200).json({
      status: "success",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        city: user.city,
        avatar: user.avatar,
        role: user.role,
        provider: user.provider,
        isVerified: user.isVerified,
        status: user.status,
        kycStatus: user.kycStatus,
        referralCode: user.referralCode,
        referredBy: user.referredBy, // populated: { firstName, lastName, referralCode }
        wallet: user.wallet,
        referralStats: user.referralStats,
        createdAt: user.createdAt,
      },
      ...(propertyInfo && { propertyInfo }),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ====================================================
// @desc    Admin — Get all users with PENDING KYC
// @route   GET /api/admin/kyc/pending
// @access  Private (Admin only)
// ====================================================
export const getPendingKycList = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const searchFilter = search
      ? {
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const filter = {
      kycStatus: "Pending",
      "kycDocuments.0": { $exists: true }, // must have at least 1 document submitted
      ...searchFilter,
    };

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select(
        "firstName lastName email phone role status kycStatus kycNotes kycDocuments createdAt",
      )
      .sort({ updatedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const data = users.map((user) => ({
      userId: user._id,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A",
      email: user.email || null,
      phone: user.phone || null,
      role: user.role,
      accountStatus: user.status,
      kycStatus: user.kycStatus,
      kycNotes: user.kycNotes || "",
      totalDocuments: user.kycDocuments.length,
      // Break down per-document status so admin sees what needs review
      documents: user.kycDocuments.map((doc) => ({
        name: doc.name,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: doc.status,
        remark: doc.remark || "",
        uploadedAt: doc.uploadedAt,
        expiresAt: doc.expiresAt || null,
      })),
      submittedAt: user.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getPendingKycList error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ====================================================
// @desc    User submits KYC documents
// @route   POST /api/kyc/submit
// @access  Private (requires JWT - any role)
// ====================================================
export const submitKyc = async (req, res) => {
  try {
    const userId = req.body.userId; // from protect middleware

    const { kycDocuments } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ message: "Your account has been banned" });
    }

    // Prevent re-submission if already verified
    if (user.kycStatus === "Verified") {
      return res.status(400).json({
        message: "KYC already verified. No further submission needed.",
      });
    }

    // ── Generic KYC Documents ──────────────────────────────────────────
    // Expects array: [{ name, documentType, documentUrl, expiresAt? }]
    if (kycDocuments && Array.isArray(kycDocuments)) {
      const allowedTypes = [
        "Aadhar",
        "Pan",
        "Passport",
        "DrivingLicense",
        "VoterID",
      ];

      for (const doc of kycDocuments) {
        if (!doc.documentType || !doc.documentUrl) {
          return res.status(400).json({
            message: "Each document must have a documentType and documentUrl",
          });
        }

        if (!allowedTypes.includes(doc.documentType)) {
          return res.status(400).json({
            message: `Invalid documentType: ${doc.documentType}. Allowed: ${allowedTypes.join(", ")}`,
          });
        }
      }

      // Merge: update existing docs of same type, append new ones
      for (const incoming of kycDocuments) {
        const existingIndex = user.kycDocuments.findIndex(
          (d) =>
            d.documentType === incoming.documentType &&
            d.name === incoming.name,
        );

        const docEntry = {
          name: incoming.name || incoming.documentType,
          documentType: incoming.documentType,
          documentUrl: incoming.documentUrl,
          expiresAt: incoming.expiresAt || null,
          status: "Pending", // reset to Pending on re-submit
          remark: "",
          uploadedAt: new Date(),
        };

        if (existingIndex !== -1) {
          // Replace existing document of the same type
          user.kycDocuments[existingIndex] = docEntry;
        } else {
          user.kycDocuments.push(docEntry);
        }
      }
    }

    // At least one document section must be provided
    if (!kycDocuments) {
      return res.status(400).json({
        message: "Provide at least one of: kycDocuments, pan, or aadhar",
      });
    }

    // Reset overall KYC status back to Pending on any re-submission
    user.kycStatus = "Pending";

    await user.save();

    return res.status(200).json({
      success: true,
      message: "KYC documents submitted successfully. Awaiting admin review.",
      data: {
        kycStatus: user.kycStatus,
        kycDocuments: user.kycDocuments,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ====================================================
// @desc    Admin reviews KYC documents (per document)
// @route   PUT /api/kyc/:userId/review
// @access  Private (Admin only)
// ====================================================
export const reviewKyc = async (req, res) => {
  try {
    const { userId } = req.params;
    const { kycDocuments, kycNotes, adminId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!kycDocuments && kycNotes === undefined) {
      return res.status(400).json({
        message: "Provide at least kycDocuments or kycNotes",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const admin = await User.findById(adminId);

    if (!admin?._id || admin.role !== "admin") {
      return res.status(400).json({
        message: "Admin not found",
      });
    }

    const allowedStatuses = ["Pending", "Verified", "Rejected"];

    if (kycDocuments && Array.isArray(kycDocuments)) {
      for (const verdict of kycDocuments) {
        // ── name is now required in review too ──────────────────────────
        if (!verdict.documentType || !verdict.name || !verdict.status) {
          return res.status(400).json({
            message: "Each verdict must have documentType, name, and status",
          });
        }

        if (!allowedStatuses.includes(verdict.status)) {
          return res.status(400).json({
            message: `Invalid status: "${verdict.status}". Allowed: ${allowedStatuses.join(", ")}`,
          });
        }

        if (verdict.status === "Rejected" && !verdict.remark?.trim()) {
          return res.status(400).json({
            message: `remark is required when rejecting "${verdict.name}" (${verdict.documentType})`,
          });
        }

        // ── Match by BOTH documentType AND name ─────────────────────────
        // This correctly handles multiple docs with the same documentType
        // e.g. "Aadhar Front" and "Aadhar Back" are both documentType: "Aadhar"
        const docIndex = user.kycDocuments.findIndex(
          (d) =>
            d.documentType === verdict.documentType && d.name === verdict.name,
        );

        if (docIndex === -1) {
          return res.status(400).json({
            message: `Document not found: name="${verdict.name}", documentType="${verdict.documentType}"`,
          });
        }

        user.kycDocuments[docIndex].status = verdict.status;
        user.kycDocuments[docIndex].remark = verdict.remark?.trim() || "";
      }
    }

    if (kycNotes !== undefined) {
      user.kycNotes = kycNotes.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "KYC documents reviewed. Use /finalise to set overall status.",
      data: {
        userId: user._id,
        kycStatus: user.kycStatus,
        kycNotes: user.kycNotes,
        kycDocuments: user.kycDocuments,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ====================================================
// @desc    Admin finalises overall KYC status
// @route   PUT /api/kyc/:userId/finalise
// @access  Private (Admin only)
//
// Call this AFTER reviewKyc to set the top-level
// kycStatus to "Verified" or "Rejected" in one shot.
// ====================================================
export const finaliseKyc = async (req, res) => {
  try {
    const { userId } = req.params;
    const { kycStatus, kycNotes, id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!["Verified", "Rejected"].includes(kycStatus)) {
      return res.status(400).json({
        message: "kycStatus must be 'Verified' or 'Rejected'",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ── Admin check ────────────────────────────────────────────────────
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid admin ID" });
    }

    const admin = await User.findById(id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Admin access required.",
      });
    }

    // ── Verification guard ─────────────────────────────────────────────
    // Collects ALL submitted verifiable items across all three sources:
    // kycDocuments[] + pan (if submitted) + aadhar (if submitted)
    // ── Verification guard ─────────────────────────────────────────────
    if (kycStatus === "Verified") {
      const allItems = [...user.kycDocuments];

      // ── TEMP DEBUG — remove before production ──────────────────────
      console.log("📋 All kycDocuments:");
      allItems.forEach((d, i) => {
        console.log(
          `  [${i}] documentType: ${d.documentType} | status: ${d.status}`,
        );
      });
      // ───────────────────────────────────────────────────────────────

      if (allItems.length === 0) {
        return res.status(400).json({
          message: "No documents have been submitted yet. Cannot verify.",
        });
      }

      const unresolvedDocs = allItems.filter((d) => d.status !== "Verified");

      // ── TEMP DEBUG — shows exactly which docs are blocking ─────────
      if (unresolvedDocs.length > 0) {
        console.log("❌ Blocking documents:");
        unresolvedDocs.forEach((d) => {
          console.log(
            `  documentType: ${d.documentType} | status: ${d.status}`,
          );
        });
      }
      // ───────────────────────────────────────────────────────────────

      if (unresolvedDocs.length > 0) {
        return res.status(400).json({
          message:
            "Cannot finalise as Verified while some documents are still " +
            "Pending or Rejected. Use /:userId/review to approve each document first.",
          // ── TEMP: expose blocking docs in response so you can see in Postman
          blockedDocuments: unresolvedDocs.map((d) => ({
            documentType: d.documentType,
            status: d.status,
            remark: d.remark,
          })),
        });
      }
    }

    // ── Update ─────────────────────────────────────────────────────────
    user.kycStatus = kycStatus;
    if (kycNotes !== undefined) user.kycNotes = kycNotes.trim();

    await user.save();

    return res.status(200).json({
      success: true,
      message: `KYC ${kycStatus === "Verified" ? "approved" : "rejected"} successfully`,
      data: {
        userId: user._id,
        kycStatus: user.kycStatus,
        kycNotes: user.kycNotes,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ====================================================
// @desc    Admin — Get all users with PENDING bank account
// @route   GET /api/admin/bank/pending
// @access  Private (Admin only)
// ====================================================
export const getPendingBankList = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const searchFilter = search
      ? {
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const filter = {
      "bankDetails.status": "Pending",
      "bankDetails.accountNumber": { $exists: true, $ne: "" }, // must have submitted
      ...searchFilter,
    };

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select(
        "firstName lastName email phone role status bankDetails createdAt updatedAt",
      )
      .sort({ updatedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const data = users.map((user) => ({
      userId: user._id,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A",
      email: user.email || null,
      phone: user.phone || null,
      role: user.role,
      accountStatus: user.status,
      bankDetails: {
        name: user.bankDetails.name || "",
        bankName: user.bankDetails.bankName || "",
        // Full account number visible to admin
        accountNumber: user.bankDetails.accountNumber,
        ifscCode: user.bankDetails.ifscCode || "",
        accountType: user.bankDetails.accountType || "Savings",
        proofUrl: user.bankDetails.proofUrl || null,
        status: user.bankDetails.status,
        remark: user.bankDetails.remark || "",
        verifiedAt: user.bankDetails.verifiedAt || null,
      },
      submittedAt: user.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getPendingBankList error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ====================================================
// @desc    User submits bank account details
// @route   POST /api/kyc/bank/submit
// @access  Private (any role)
// ====================================================
export const submitBankDetails = async (req, res) => {
  try {
    const userId = req.body.userId;

    const {
      name, // account holder name
      accountNumber,
      ifscCode,
      bankName,
      accountType, // "Savings" | "Current"
      proofUrl, // cancelled cheque / passbook image URL
    } = req.body;

    // ── Validation ─────────────────────────────────────────────────────
    if (!name || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({
        message: "name, accountNumber, ifscCode, and bankName are required",
      });
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode.toUpperCase())) {
      return res.status(400).json({
        message: "Invalid IFSC code format (e.g. SBIN0001234)",
      });
    }

    const accRegex = /^[0-9]{9,18}$/;
    if (!accRegex.test(accountNumber)) {
      return res.status(400).json({
        message: "Invalid account number. Must be 9–18 digits.",
      });
    }

    if (accountType && !["Savings", "Current"].includes(accountType)) {
      return res.status(400).json({
        message: "accountType must be 'Savings' or 'Current'",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ message: "Your account has been banned" });
    }

    // Prevent re-submission if already verified
    if (user.bankDetails?.status === "Verified") {
      return res.status(400).json({
        message:
          "Bank account already verified. Contact support to update details.",
      });
    }

    user.bankDetails = {
      name: name.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.toUpperCase().trim(),
      bankName: bankName.trim(),
      accountType: accountType || "Savings",
      proofUrl: proofUrl?.trim() || "",
      status: "Pending", // reset to Pending on (re-)submission
      remark: "",
      verifiedAt: null,
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Bank details submitted successfully. Awaiting admin verification.",
      data: {
        bankDetails: {
          name: user.bankDetails.name,
          bankName: user.bankDetails.bankName,
          // Mask account number — show last 4 digits only
          accountNumber: user.bankDetails.accountNumber.replace(
            /\d(?=\d{4})/g,
            "*",
          ),
          ifscCode: user.bankDetails.ifscCode,
          accountType: user.bankDetails.accountType,
          status: user.bankDetails.status,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ====================================================
// @desc    Admin verifies / rejects bank account
// @route   PUT /api/kyc/:userId/bank/verify
// @access  Private (Admin only)
// ====================================================
export const verifyBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, remark, adminId } = req.body;

    const admin = await User.findById(adminId);

    if (!admin?._id || admin.role !== "admin") {
      return res.status(400).json({
        message: "Admin not found",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!["Verified", "Rejected"].includes(status)) {
      return res.status(400).json({
        message: "status must be 'Verified' or 'Rejected'",
      });
    }

    if (status === "Rejected" && !remark?.trim()) {
      return res.status(400).json({
        message: "A rejection remark is required when rejecting bank details",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.bankDetails?.accountNumber) {
      return res.status(400).json({
        message: "User has not submitted bank details yet",
      });
    }

    user.bankDetails.status = status;
    user.bankDetails.remark = remark?.trim() || "";
    user.bankDetails.verifiedAt = status === "Verified" ? new Date() : null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Bank account ${status === "Verified" ? "verified" : "rejected"} successfully`,
      data: {
        userId: user._id,
        bankDetails: {
          name: user.bankDetails.name,
          bankName: user.bankDetails.bankName,
          accountNumber: user.bankDetails.accountNumber.replace(
            /\d(?=\d{4})/g,
            "*",
          ),
          ifscCode: user.bankDetails.ifscCode,
          accountType: user.bankDetails.accountType,
          status: user.bankDetails.status,
          remark: user.bankDetails.remark,
          verifiedAt: user.bankDetails.verifiedAt,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ====================================================
// @desc    Get KYC + bank status (admin or self)
// @route   GET /api/kyc/:userId/status
// @access  Private
// ====================================================
export const getKycStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.body.userId;
    const requesterRole = req.body.role;

    // Users can only view their own; admins can view anyone
    if (requesterRole !== "admin" && requesterId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId).select(
      "firstName lastName phone email kycStatus kycDocuments kycNotes pan aadhar bankDetails",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          email: user.email,
        },
        kyc: {
          kycStatus: user.kycStatus,
          kycNotes: user.kycNotes,
          kycDocuments: user.kycDocuments,
          pan: user.pan
            ? {
                number:
                  requesterRole === "admin" ? user.pan.number : user.pan.number, // both see it; mask if needed
                status: user.pan.status,
                remark: user.pan.remark,
              }
            : null,
          aadhar: user.aadhar
            ? {
                // Mask for the user, full number for admin
                number:
                  requesterRole === "admin"
                    ? user.aadhar.number
                    : user.aadhar.number.replace(/\d(?=\d{4})/g, "*"),
                status: user.aadhar.status,
                remark: user.aadhar.remark,
              }
            : null,
        },
        bankDetails: user.bankDetails?.accountNumber
          ? {
              name: user.bankDetails.name,
              bankName: user.bankDetails.bankName,
              accountNumber:
                requesterRole === "admin"
                  ? user.bankDetails.accountNumber
                  : user.bankDetails.accountNumber.replace(/\d(?=\d{4})/g, "*"),
              ifscCode: user.bankDetails.ifscCode,
              accountType: user.bankDetails.accountType,
              status: user.bankDetails.status,
              remark: user.bankDetails.remark,
              verifiedAt: user.bankDetails.verifiedAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ====================================================
// @desc    Get user confidential info
//          (KYC documents, KYC status, bank details, bank status)
// @route   GET /api/users/:userId/confidential
// @access  Public
// ====================================================
export const getUserConfidentialInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(userId).select(
      "firstName lastName phone email status kycStatus kycNotes kycDocuments bankDetails",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status === "banned") {
      return res.status(403).json({
        success: false,
        message: "This account has been banned",
      });
    }

    // ── KYC documents ─────────────────────────────────────────────────
    const kycDocuments = (user.kycDocuments || []).map((doc) => ({
      name: doc.name,
      documentType: doc.documentType,
      documentUrl: doc.documentUrl,
      status: doc.status,
      remark: doc.remark || "",
      uploadedAt: doc.uploadedAt,
      expiresAt: doc.expiresAt || null,
    }));

    // ── Bank details ──────────────────────────────────────────────────
    const bankDetails = user.bankDetails?.accountNumber
      ? {
          name: user.bankDetails.name || "",
          bankName: user.bankDetails.bankName || "",
          accountNumber: user.bankDetails.accountNumber,
          ifscCode: user.bankDetails.ifscCode || "",
          accountType: user.bankDetails.accountType || "Savings",
          proofUrl: user.bankDetails.proofUrl || null,
          status: user.bankDetails.status || "Pending",
          remark: user.bankDetails.remark || "",
          verifiedAt: user.bankDetails.verifiedAt || null,
        }
      : null;

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          email: user.email,
          status: user.status,
        },
        kyc: {
          overallStatus: user.kycStatus,
          kycNotes: user.kycNotes || "",
          documents: kycDocuments,
        },
        bankDetails: bankDetails ?? {
          message: "No bank details submitted yet",
        },
      },
    });
  } catch (error) {
    console.error("getUserConfidentialInfo error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
