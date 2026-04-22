import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      unique: true
    },
    // phone: {
    //   type: String,
    //   required: [true, "Phone number is required"],
    //   unique: true,
    //   match: [/^[0-9]{10,15}$/, "Please enter a valid phone number"],
    // },
    phone: {
      type: String,
      sparse: true,
      unique: true,
      match: [/^[0-9]{10,15}$/, "Please enter a valid phone number"],
    },
    password: {
      type: String,
      minlength: 6,
      select: false, // don’t return password unless explicitly asked
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["customer", "hotelier", "admin"],
      default: "customer",
    },
    roles: {
      type: [String],
      enum: ["customer", "hotelier", "admin"],
      default: ["customer"],
    },
    provider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },
    googleId: {
      type: String,
      index: true,
    },
    facebookId: {
      type: String,
      index: true,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpiry: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "banned"],
      default: "active",
    },
    // ---- Verification (KYC) ----
    kycStatus: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
    kycDocuments: [
      {
        name: { type: String, trim: true },
        documentType: { type: String, trim: true },
        documentUrl: { type: String, trim: true },
        status: {
          type: String,
          enum: ["Pending", "Verified", "Rejected"],
          default: "Pending",
        },
        uploadedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },
      },
    ],
    kycNotes: { type: String, trim: true, default: "" },

    // Bank Account — mirrors PropertyInfo.bankDetails + verification
    bankDetails: {
      name: { type: String, trim: true }, // Account holder name
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true }, // e.g. "SBI", "HDFC"
      accountType: {
        type: String,
        enum: ["Savings", "Current"],
        default: "Savings",
      },
      // Verification
      status: {
        type: String,
        enum: ["Pending", "Verified", "Rejected"],
        default: "Pending",
      },
      remark: { type: String, default: "", trim: true },
      verifiedAt: { type: Date },
      // Optional: cancelled cheque / passbook image for proof
      proofUrl: { type: String, trim: true },
    },

    bypassAutoCheck: { type: Boolean, default: false },
    flags: { type: Number, default: 0 },

    // ------------------
    // 4 Level MLM System
    // ------------------

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // Stores up to 4 uplines
    referralPath: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    wallet: {
      balance: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      totalWithdrawn: { type: Number, default: 0 },
    },

    referralStats: {
      level1Count: { type: Number, default: 0 },
      level2Count: { type: Number, default: 0 },
      level3Count: { type: Number, default: 0 },
      level4Count: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

//Hash password before saving (only if password exists)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Auto generate referral code
// userSchema.pre("save", function (next) {
//   if (!this.referralCode) {
//     const random = Math.random().toString(36).substring(2, 8).toUpperCase();
//     this.referralCode = "JS" + random;
//   }
//   next();
// });

//Compare password for login
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
