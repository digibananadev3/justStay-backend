import mongoose from "mongoose";
const { Schema } = mongoose;



// -----------------------------------------
// ENUMS
// -----------------------------------------
const bookingTypes = ["Online", "Manual"];
const bookingStatuses = ["Booked", "CheckIn", "CheckOut", "Cancel"];
const paymentStatuses = ["pending", "paid", "failed", "refunded", "partial"];
const bookingSources = ["JustStay App", "Website", "Booking.com", "Expedia", "OTA"];



// -----------------------------------------
// SUB-SCHEMAS
// -----------------------------------------
const guestDetailsSchema = new Schema({
  name: { type: String, required: true },
  fatherOrSpouseName: { type: String },
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  age: { type: Number },
  address: { type: String },
  pincode: { type: String },
  city: { type: String },
  state: { type: String },
  phone: { type: String },
  email: { type: String },
});



const identificationProofSchema = new Schema({
  type: { type: String },
  number: { type: String },
  documentUrl: { type: String },
});



const coGuestDetailsSchema = new Schema({
  name: { type: String },
  idType: { type: String },
  number: { type: String },
  idUrl: { type: String },
});


const foodSchema = new Schema({
  name: { type: String },
  quantity: { type: Number, default: 1 },
});


const priceSummarySchema = new Schema({
  roomPrice: { type: Number, default: 0 },
  foodPrice: { type: Number, default: 0 },
  taxAndServiceFees: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  // agreedDailyRate: { type: Number, default: 0 },
});

const refundSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["none", "requested", "approved", "processed", "rejected"],
      default: "none",
    },
    amount: { type: Number, default: 0 },
    reason: { type: String },
    processedAt: { type: Date },
  },{ _id: false },
);

const disputeSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["none", "open", "resolved", "rejected"],
      default: "none",
    },
    reason: { type: String },
    notes: { type: String },
    openedAt: { type: Date },
    resolvedAt: { type: Date },
  },
  { _id: false },
);


// -----------------------------------------
// STAY DETAILS — covers all 5 plan types
// -----------------------------------------
const stayDetailsSchema = new Schema({
  roomNumber: { type: String },
  roomType: { type: String },
  adults: { type: Number, default: 1 },
  children: { type: Number, default: 0 },
  purposeOfVisit: { type: String },

  // Check-in (all plans)
  checkInDate: { type: Date },
  checkInTime: { type: String },    // "14:00"

  // -- 3hr / 6hr slots --
  slotEndTime: { type: String },           // "17:00" — auto-calculated from checkInTime + plan

  nightCheckOutTime: { type: String },     // "11:00"
  
  expectedCheckOutDate: { type: Date },
  expectedCheckOutTime: { type: String },
});

// -----------------------------------------
// MAIN SCHEMA
// -----------------------------------------
const roomBookingSchema = new Schema(
  {
    bookingCode: { type: String, trim: true },

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

    //  Updated
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "PropertyRoom",
      required: true,
    },

    // ---- PLAN (drives all logic) ----
    // 3hr        → slot booking, slotEndTime auto-set
    // 6hr        → slot booking, slotEndTime auto-set
    // night      → checks out next morning at nightCheckOutTime
    // date-to-date → expectedCheckOutDate required
    // open-stay  → no checkout date, room locked until actual checkout
    plan: { type: String, enum: ["3hr", "6hr", "night", "date-to-date", "open-stay"], required: true },

        type: {
      type: String,
      enum: bookingTypes,
      required: true,
      default: "Online",
    },

    source: { type: String, enum: bookingSources, default: "JustStay App" },

    mealPlan: {
      type: String,
      enum: ["roomOnly", "withBreakfast"],
      required: true,
    },

    status: {
      type: String,
      enum: bookingStatuses,
      required: true,
      default: "Booked",
    },

    paymentStatus: { type: String, enum: paymentStatuses, default: "pending" },

        // ADD COUPON
    coupon: {
      code: { type: String },
      discountAmount: { type: Number, default: 0 },
    },

     // Only used when plan = "open-stay" — rate locked at check-in
    agreedDailyRate: { type: Number, default: 0 },

    isHourly: { type: Boolean, default: false },

    // true only for open-stay
    isOpenStay: { type: Boolean, default: false },






    rewardProcessed: {
      type: Boolean,
      default: false,
    },

    guestDetails: guestDetailsSchema,
    identificationProof: identificationProofSchema,
    stayDetails: stayDetailsSchema,
    coGuestDetails: [coGuestDetailsSchema],

    actualCheckInAt: { type: Date },
    actualCheckOutAt: { type: Date },
    
    food: [foodSchema],
    priceSummary: priceSummarySchema,
    
    refund: refundSchema,
    dispute: disputeSchema,

    // checkOutDate: { type: Date },
    // time: { type: String },

    paymentInfo: {
      method: { type: String, trim: true },
      transactionId: { type: String, trim: true },
    },
    adminNotes: { type: String, trim: true, default: "" },
    specialRequests: { type: String, trim: true, default: "" },
    voucherUrl: { type: String, trim: true },
    confirmationSentAt: { type: Date },
  },
  { timestamps: true },
);

// -----------------------------------------
// MODEL EXPORT
// -----------------------------------------
const RoomBooking = mongoose.model("RoomBooking", roomBookingSchema);
export default RoomBooking;
