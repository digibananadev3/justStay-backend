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



const mealPricingSchema = new Schema(
  {
    roomOnly: {
      type: Number,
      required: true,
      min: 0,
    },
    withBreakfast: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);


// -----------------------------
// Property Room Schema
// -----------------------------
const propertyRoomSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "PropertyInfo",
      required: true,
      index: true,
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

    // price: {
    //   oneNight: { type: Number, required: true }, // "1 night price"
    //   threeHours: { type: Number, default: 0 },    // "3 hours price"
    //   sixHours: { type: Number, default: 0 },      // "6 hours price"
    // },
    // ✅ FINAL PRICING STRUCTURE
    pricing: {
      oneNight: { type: mealPricingSchema, required: true },
      threeHours: { type: mealPricingSchema, required: true },
      sixHours: { type: mealPricingSchema, required: true },
            dateToDate: { type: mealPricingSchema, required: true }, // per night
      openStay:   { type: mealPricingSchema, required: true }, // daily rate
    },


    amenities: { type: [String], default: [] },

    // Pricing adjustments
    discounts: {
      oneNightPercent: { type: Number, default: 0, min: 0, max: 100 },
      threeHoursPercent: { type: Number, default: 0, min: 0, max: 100 },
      sixHoursPercent: { type: Number, default: 0, min: 0, max: 100 },
            dateToDatePercent: { type: Number, default: 0, min: 0, max: 100 },
      openStayPercent:   { type: Number, default: 0, min: 0, max: 100 },
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


// For faster property filtering
propertyRoomSchema.index({ propertyId: 1, type: 1 });

// -----------------------------
// Export model
// -----------------------------
const PropertyRoom = mongoose.model("PropertyRoom", propertyRoomSchema);
export default PropertyRoom;
