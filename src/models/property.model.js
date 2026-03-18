import mongoose from "mongoose";

const { Schema } = mongoose;

// -----------------------------
// Enum definitions
// -----------------------------
const propertyTypes = [
  "Villa",
  "Homestay",
  "Cottage",
  "Apartment",
  "Entire Property",
  "Private Room",
];

const documentTypes = ["Electricity", "Phone", "Aadhar", "Pan"];

const statusTypes = ["Under Review", "Accepted", "Rejected"];

// -----------------------------
// PropertyInfo Schema
// -----------------------------
const propertySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agreement: {
      type: String,
      required: true,
    },
    propertyAmenities: {
      type: [String],
      default: [],
    },
    propertyType: {
      type: String,
      //enum: propertyTypes,
      required: true,
    },
    stayType: {
      type: [String],
      enum: ["Family", "Couple", "Business"],
      default: [],
      index: true,
    },
    propertyListType: {
      type: String,
      required: true,
    },
    pricing: {
      minOneNightPrice: { type: Number, default: 0 },
      maxOneNightPrice: { type: Number, default: 0 },

      minThreeHoursPrice: { type: Number, default: 0 },
      maxThreeHoursPrice: { type: Number, default: 0 },

      minSixHoursPrice: { type: Number, default: 0 },
      maxSixHoursPrice: { type: Number, default: 0 },
    },
    screenNumber: {
      type: Number,
      required: true,
    },
    basicPropertyDetails: {
      name: { type: String, required: true, trim: true },
      builtYear: { type: Number },
      bookingSince: { type: Number },
    },

    contactDetails: {
      email: { type: String, lowercase: true, trim: true },
      mobile: { type: String, trim: true },
      landline: { type: String, trim: true },
    },

    location: {
      house: { type: String, trim: true },
      area: { type: String, trim: true },
      landmarks: {
        type: [String],
        default: [],
      },
      pincode: { type: Number, min: 100000, max: 999999 },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },

      // Added the cordinates field for geospatial queries
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0],
        },
      },
    },

    documents: [
      {
        name: { type: String, trim: true },
        documentType: { type: String, enum: documentTypes, required: true },
        documentUrl: { type: String, required: true },
        status: {
          type: String,
          enum: ["Pending", "Verified", "Rejected"],
          default: "Pending",
        },

        // ADD THIS
        remark: {
          type: String,
          default: "",
          trim: true,
        },
        uploadedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },
      },
    ],

    status: {
      type: String,
      enum: statusTypes,
      default: "Under Review",
    },

    // Admin verification helpers
    verificationNotes: { type: String, trim: true, default: "" },
    bypassAutoCheck: { type: Boolean, default: false },

    // Listing workflow
    listingStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    badges: {
      verifiedBadge: { type: Boolean, default: false },
      goSafeBadge: { type: Boolean, default: false },
      hourlyBooking: { type: Boolean, default: false },
      coupleFriendly: { type: Boolean, default: false },
    },
    flags: { type: [String], default: [] },

    photos: {
      type: [
        {
          name: { type: String, required: true },
          url: { type: String, required: true },
          status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            default: "Pending",
          },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    videos: {
      type: [
        {
          title: { type: String, trim: true },
          url: { type: String, required: true },
          thumbnail: { type: String, trim: true },
          status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            default: "Pending",
          },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // PAN
    pan: {
      number: { type: String, trim: true },
      front: { type: String, trim: true },
      back: { type: String, trim: true },
    },

    // Aadhar
    aadhar: {
      number: { type: String, trim: true },
      front: { type: String, trim: true },
      back: { type: String, trim: true },
    },

    // Bank Details
    bankDetails: {
      name: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
    },

    // GST
    gst: {
      number: { type: String, trim: true },
      front: { type: String, trim: true },
      back: { type: String, trim: true },
    },

    // Business License
    businessLicense: {
      number: { type: String, trim: true },
      front: { type: String, trim: true },
      back: { type: String, trim: true },
    },

    trainingAndGuidelines: { type: String, default: "" }, // long text / log

    // --------- Rating summary (ADD THIS) --------
    guestAverageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      index: true, // IMPORTANT for filtering & sorting
    },

    guestTotalReviews: {
      type: Number,
      default: 0,
    },

    hotelRating: {
      type: Number, // Official star rating
      min: 1,
      max: 5,
      default: 0,
      index: true,
    },

    // -------- SOFT DELETE FIELDS --------
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // ------------------------------------
  },
  { timestamps: true }, // createdAt & updatedAt
);

// 2dsphere index for geo queries
propertySchema.index({ "location.coordinates": "2dsphere" });

// -----------------------------
// Export model
// -----------------------------
const PropertyInfo = mongoose.model("PropertyInfo", propertySchema);
export default PropertyInfo;
