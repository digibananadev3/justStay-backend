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

const stayDetailsSchema = new Schema({
  roomNumber: { type: String },
  roomType: { type: String },
  adults: { type: Number, default: 1 },
  children: { type: Number, default: 0 },
  checkInDate: { type: Date },
  checkInTime: { type: String },
  expectedCheckOutDate: { type: Date },
  expectedCheckOutTime: { type: String },
  purposeOfVisit: { type: String },
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
});

const refundSchema = new Schema({
  status: { type: String, enum: ["none", "requested", "approved", "processed", "rejected"], default: "none" },
  amount: { type: Number, default: 0 },
  reason: { type: String },
  processedAt: { type: Date }
}, { _id: false });

const disputeSchema = new Schema({
  status: { type: String, enum: ["none", "open", "resolved", "rejected"], default: "none" },
  reason: { type: String },
  notes: { type: String },
  openedAt: { type: Date },
  resolvedAt: { type: Date }
}, { _id: false });

// -----------------------------------------
// MAIN SCHEMA
// -----------------------------------------
const roomBookingSchema = new Schema(
  {
    bookingCode: { type: String, trim: true },
    //online =customer books via website
    //manual= Hotelire does the booking for customer
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
    type: {
      type: String,
      enum: bookingTypes,
      required: true,
      default: "Online",
    },

    source: { type: String, enum: bookingSources, default: "JustStay App" },
    paymentStatus: { type: String, enum: paymentStatuses, default: "pending" },
    isHourly: { type: Boolean, default: false },

    status: {
      type: String,
      enum: bookingStatuses,
      required: true,
      default: "Booked",
    },

    guestDetails: guestDetailsSchema,

    identificationProof: identificationProofSchema,

    stayDetails: stayDetailsSchema,

    coGuestDetails: [coGuestDetailsSchema],

    checkOutDate: { type: Date },
    time: { type: String },
    actualCheckInAt: { type: Date },
    actualCheckOutAt: { type: Date },

    food: [foodSchema],

    priceSummary: priceSummarySchema,

    refund: refundSchema,
    dispute: disputeSchema,

    paymentInfo: {
      method: { type: String, trim: true },
      transactionId: { type: String, trim: true }
    },
    adminNotes: { type: String, trim: true, default: '' },
    specialRequests: { type: String, trim: true, default: '' },
    voucherUrl: { type: String, trim: true },
    confirmationSentAt: { type: Date },
  },
  { timestamps: true }
);

// -----------------------------------------
// MODEL EXPORT
// -----------------------------------------
const RoomBooking = mongoose.model("RoomBooking", roomBookingSchema);
export default RoomBooking;
