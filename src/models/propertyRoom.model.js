import mongoose from "mongoose";

const { Schema } = mongoose;

// -----------------------------
// Enum definitions
// -----------------------------
const roomTypes = [
  "Standard",
  "Deluxe",
  "Super Deluxe",
  "Suite",
  "Executive Suite",
  "Family Room",
  "Presidential Suite"
];

// -----------------------------
// Property Room Schema
// -----------------------------
const propertyRoomSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "PropertyInfo",
      required: true,
    },

    // Optional reference to master room type list
    roomTypeId: {
      type: Schema.Types.ObjectId,
      ref: "RoomType",
    },

    type: {
      type: String,
      // enum: roomTypes,
      required: true,
      default: "Standard",
    },

    area: { type: Number, required: true }, // in sq.ft (or sqm)
    bed: { type: Number, required: true },
    bathroom: { type: Number, required: true },
    numberOfRooms: { type: Number, default: 1 },

    // Specific room numbers as per UI (e.g., 101, 102)
    roomNumbers: { type: [String], default: [] },

    price: {
      oneNight: { type: Number, required: true }, // "1 night price"
      threeHours: { type: Number, default: 0 },    // "3 hours price"
      sixHours: { type: Number, default: 0 },      // "6 hours price"
    },

    photos: { type: [String], default: [] },

    amenities: { type: [String], default: [] },

    // Pricing adjustments
    discounts: {
      oneNightPercent: { type: Number, default: 0, min: 0, max: 100 },
      threeHoursPercent: { type: Number, default: 0, min: 0, max: 100 },
      sixHoursPercent: { type: Number, default: 0, min: 0, max: 100 },
    },

    promo: {
      code: { type: String, trim: true },
      discountPercent: { type: Number, min: 0, max: 100 },
      validFrom: { type: Date },
      validTo: { type: Date },
      isActive: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// -----------------------------
// Export model
// -----------------------------
const PropertyRoom = mongoose.model("PropertyRoom", propertyRoomSchema);
export default PropertyRoom;
