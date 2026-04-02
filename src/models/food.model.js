import mongoose from "mongoose";


 
/* =========================
   Restaurant Schema
========================= */
const RestaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);
 
/* =========================
   Food Schema
   Owned by a Restaurant.
   Each food item belongs to one restaurant and carries
   its own price and images. No stock fields.
========================= */
const FOOD_CATEGORIES = [
  "starter",
  "main_course",
  "dessert",
  "beverage",
  "snack",
  "breakfast",
  "combo",
  "other",
];
 

const FoodSchema = new mongoose.Schema(
  {
    restaurantId: {
      // Food is created by and belongs to a specific restaurant
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: FOOD_CATEGORIES,
      required: true,
    },
    images: [
      {
        type: String, // image URL or file path
        required: true,
      },
    ],
    price: {
      // Base price set by the restaurant when creating the food
      type: Number,
      required: true,
      min: 0,
    },
    isAvailable: {
      // Restaurant can hide items without deleting them
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);
 
FoodSchema.index({ restaurantId: 1, isAvailable: 1 });



 
/* =========================
   PropertyFood Schema
========================= */
const PropertyRoomFoodSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyInfo",
      required: true,
    },

    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomBooking",
      required: true,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },

    basePrice: {
      // snapshot from Food.price
      type: Number,
      required: true,
    },

    extraPrice: {
      // markup added per room/property
      type: Number,
      default: 0,
      min: 0,
    },

    finalPrice: {
      // basePrice + extraPrice
      type: Number,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// prevent duplicate assignment
PropertyRoomFoodSchema.index(
  { propertyId: 1, roomId: 1, foodId: 1 },
  { unique: true }
);

// fast queries
PropertyRoomFoodSchema.index({ propertyId: 1, roomId: 1, isActive: 1 });

 
/* =========================
   MODELS
========================= */
const Restaurant =
  mongoose.models.Restaurant ||
  mongoose.model("Restaurant", RestaurantSchema);
 
const Food =
  mongoose.models.Food ||
  mongoose.model("Food", FoodSchema);
 

const PropertyRoomFood =
  mongoose.models.PropertyRoomFood ||
  mongoose.model("PropertyRoomFood", PropertyRoomFoodSchema);
 
/* =========================
   EXPORTS
========================= */
export { Restaurant, Food, PropertyRoomFood, FOOD_CATEGORIES };