import mongoose from "mongoose";
const { Schema } = mongoose;

const roomInventorySchema = new Schema(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "PropertyRoom",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },

    // Total rooms available for this date
    allotment: { type: Number, default: 0, min: 0 },

    // Which specific room numbers are already booked on this date
    // (across all plan types except open-stay which is checked via RoomBooking directly)
    bookedRoomNumbers: { type: [String], default: [] },

    open: { type: Boolean, default: true },
    stopSell: { type: Boolean, default: false },
    notes: { type: String, trim: true },

    // UI support: display day-level sellability and reasons
    sellStatus: { type: String, default: "sellable" }, //enum: ["sellable", "non_sell", "partial"]
    nonSellReasons: {
      type: [
        { type: String }, //enum: ["no_inventory", "closed", "stop_sell", "rates_missing"]
      ],
      default: [],
    },

    // Optional snapshot of base rates for quick calendar rendering (authoritative rates live elsewhere)
    baseRateSummary: {
      roomOnly: { type: Number, default: 0, min: 0 },
      // cp: { type: Number, default: 0, min: 0 },
      withBreakfast: { type: Number, default: 0, min: 0 },
    },

    // Per-day rate plans and restrictions (for Manage All Rates)
    ratePlans: {
      roomOnly: {
        baseAdults: { type: Number, default: 3, min: 0 },
        adults: {
          a1: { type: Number, default: null, min: 0 },
          a2: { type: Number, default: null, min: 0 },
          a3: { type: Number, default: null, min: 0 },
        },
        perChild0to8Free: { type: Boolean, default: true },
        perChild9to12: { type: Number, default: null, min: 0 },
        perExtraAdult: { type: Number, default: null, min: 0 },
      },
      withBreakfast: {
        baseAdults: { type: Number, default: 3, min: 0 },
        adults: {
          a1: { type: Number, default: null, min: 0 },
          a2: { type: Number, default: null, min: 0 },
          a3: { type: Number, default: null, min: 0 },
        },
        perChild0to8Free: { type: Boolean, default: true },
        perChild9to12: { type: Number, default: null, min: 0 },
        perExtraAdult: { type: Number, default: null, min: 0 },
      },
      //       cp: {
      //   baseAdults: { type: Number, default: 3, min: 0 },
      //   adults: {
      //     a1: { type: Number, default: null, min: 0 },
      //     a2: { type: Number, default: null, min: 0 },
      //     a3: { type: Number, default: null, min: 0 },
      //   },
      //   perChild0to8Free: { type: Boolean, default: true },
      //   perChild9to12: { type: Number, default: null, min: 0 },
      //   perExtraAdult: { type: Number, default: null, min: 0 },
      // },
    },
    restrictions: {
      // Minimum Advance Booking Window (time of day string like "11:59PM")
      minAdvanceBookingTime: { type: String, default: "11:59PM" },
      // Booking window days (explicit), plus maximum
      bookingWindowDays: { type: Number, default: 450, min: 0 },
      maxAdvanceDays: { type: Number, default: 450, min: 0 },
      // Minimum/Maximum Length of Stay (days)
      minLOS: { type: Number, default: 1, min: 0 },
      maxLOS: { type: Number, default: 450, min: 0 },
    },

    // Time Block Inventory Management
    timeBlocks: [
      {
        from: { type: String, required: true }, // "14:00"
        to: { type: String, required: true }, // "17:00"
        plan: { type: String, enum: ["3hr", "6hr"], required: true },
        // bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
                bookingId: { type: Schema.Types.ObjectId, ref: "RoomBooking" },
        roomNumber: { type: String },
        isBooked: { type: Boolean, default: false },
      },
    ],

    // -----------------------------------------------
    // Whole night block
    // One per inventory date. isBooked = false means available.
    // -----------------------------------------------
    nightBlock: {
      bookingId: {
        type: Schema.Types.ObjectId,
        ref: "RoomBooking",
        default: null,
      },
      roomNumber: { type: String },
      checkOutTime: { type: String }, // "11:00" — copied from property setting at booking time
      isBooked: { type: Boolean, default: false },
    },

    // -----------------------------------------------
    // Date-to-date lock
    // Written on every date between checkIn and checkOut.
    // Cleared when booking is cancelled or checked out.
    // -----------------------------------------------
    dateToDateLock: {
      bookingId: {
        type: Schema.Types.ObjectId,
        ref: "RoomBooking",
        default: null,
      },
      roomNumber: { type: String },
      isBooked: { type: Boolean, default: false },
    },

    // NOTE: open-stay availability is checked by querying RoomBooking directly:
    // { roomId, plan: "open-stay", status: "CheckIn", actualCheckOutAt: null }
    // No lock stored here — checkout updates the booking and inventory is free again.
  },
  { timestamps: true },
);

roomInventorySchema.index({ roomId: 1, date: 1 }, { unique: true });

const RoomInventory = mongoose.model("RoomInventory", roomInventorySchema);
export default RoomInventory;
