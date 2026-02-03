import mongoose from "mongoose";

/* =========================
   Restaurant Schema
========================= */
const RestaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

/* =========================
   Food Schema (GLOBAL)
========================= */
const FoodSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true
    },
    images: [
      {
        type: String, // image URL or file path
        required: true
      }
    ],
    totalStock: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   PropertyFood Schema
========================= */
const PropertyFoodSchema = new mongoose.Schema(
  {
    propertyId:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyInfo",
      required: true
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true
    },
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    availableStock: {
      type: Number,
      required: true,
      min: 0
    },
    usedStock: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

PropertyFoodSchema.index(
  { restaurantId: 1, foodId: 1 },
  { unique: true }
);

/* =========================
   RoomFood Schema
========================= */
const RoomFoodSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyInfo",
      required: true
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomBooking",
      required: true
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true
    },
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ["ordered", "served", "cancelled"],
      default: "ordered"
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   MODELS
========================= */
const Restaurant =
  mongoose.models.Restaurant ||
  mongoose.model("Restaurant", RestaurantSchema);

const Food =
  mongoose.models.Food ||
  mongoose.model("Food", FoodSchema);

const PropertyFood =
  mongoose.models.PropertyFood ||
  mongoose.model("PropertyFood", PropertyFoodSchema);

const RoomFood =
  mongoose.models.RoomFood ||
  mongoose.model("RoomFood", RoomFoodSchema);


/* =========================
   EXPORTS
========================= */
export {
  Restaurant,
  Food,
  PropertyFood,
  RoomFood
};
