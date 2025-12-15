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
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      match: [/^[0-9]{10,15}$/, "Please enter a valid phone number"],
    },
    password: {
      type: String,
      minlength: 6,
      select: false, // don’t return password unless explicitly asked
    },
    role: {
      type: String,
      enum: ["customer", "hotelier", "admin"],
      default: "customer",
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
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending'
    },
    kycDocuments: [
      {
        name: { type: String, trim: true },
        documentType: { type: String, trim: true },
        documentUrl: { type: String, trim: true },
        status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
        uploadedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date }
      }
    ],
    kycNotes: { type: String, trim: true, default: '' },
    bypassAutoCheck: { type: Boolean, default: false },
    flags: { type: Number, default: 0 },
  },
  { timestamps: true }
);

//Hash password before saving (only if password exists)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

//Compare password for login
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
