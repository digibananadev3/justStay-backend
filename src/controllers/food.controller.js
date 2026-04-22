import mongoose from "mongoose";
import { Food, PropertyRoomFood, Restaurant } from "../models/food.model.js";




/* =========================
   RESTAURANT — CREATE
========================= */
export const createRestaurant = async (req, res) => {
  try {
    const { name, location, contactNumber, email, status } = req.body;

    if (!name || !location || !contactNumber || !email) {
      return res.status(400).json({
        success: false,
        message: "Name, location, contactNumber and email are required",
      });
    }

    const restaurant = await Restaurant.create({
      name,
      location,
      contactNumber,
      email,
      status: status || "active",
    });

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      data: restaurant,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


/* =========================
   RESTAURANT — GET ALL
========================= */
export const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


/* =========================
   RESTAURANT — GET ONE
========================= */
export const getSpecificRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    return res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


/* =========================
   RESTAURANT — DELETE
   Blocked if the restaurant has food assigned to any property
========================= */
export const deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const hasAssignedFood = await PropertyFood.findOne({
      restaurantId: req.params.id,
    });

    if (hasAssignedFood) {
      return res.status(400).json({
        success: false,
        message:
          "Restaurant has food assigned to properties. Remove those assignments before deleting.",
      });
    }

    await restaurant.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Restaurant deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};





/* =========================
   FOOD — CREATE
========================= */
export const createFood = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { title, category, description, price, images, isAvailable } = req.body;

    if (!title || !category || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Title, category and price are required",
      });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one food image is required",
      });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const food = await Food.create({
      restaurantId,
      title,
      category,
      description: description || "",
      price,
      images,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
    });

    return res.status(201).json({
      success: true,
      message: "Food created successfully",
      data: food,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};



/* =========================
   GET ALL FOOD
========================= */
export const getAllFoods=async(req, res)=>{
  try {

    const getAllFoods = await Food.find({isAvailable: true});

    return res.status(200).json({
      success: true,
      message: "Get All Food successfully",
      data: getAllFoods,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/* =========================
   FOOD — GET ALL FOR A RESTAURANT
   GET /restaurants/:restaurantId/foods
========================= */
export const getFoodsByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const foods = await Food.find({ restaurantId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: foods.length,
      data: foods,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


/* =========================
   FOOD — GET ONE
========================= */
export const getFoodById = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id).populate(
      "restaurantId",
      "name location contactNumber"
    );

    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found" });
    }

    return res.status(200).json({ success: true, data: food });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


/* =========================
   FOOD — UPDATE
========================= */
export const updateFood = async (req, res) => {
  try {
    const { title, description, category, price, images, isAvailable } = req.body;

    const food = await Food.findById(req.params.id);
    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found" });
    }

    if (title !== undefined) food.title = title;
    if (description !== undefined) food.description = description;
    if (category !== undefined) food.category = category;
    if (price !== undefined) food.price = price;
    if (images !== undefined) {
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({
          success: false,
          message: "images must be a non-empty array",
        });
      }
      food.images = images;
    }
    if (isAvailable !== undefined) food.isAvailable = isAvailable;

    await food.save();

    return res.status(200).json({
      success: true,
      message: "Food updated successfully",
      data: food,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


/* =========================
   FOOD — DELETE
   Blocked if the food is assigned to any property
========================= */
export const deleteFood = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found" });
    }

    const assigned = await PropertyFood.findOne({ foodId: req.params.id });
    if (assigned) {
      return res.status(400).json({
        success: false,
        message:
          "Food is assigned to a property. Remove that assignment before deleting.",
      });
    }

    await food.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Food deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};




export const assignFoodToRoom = async (req, res) => {
  try {
    const { propertyId, roomId, foodId, extraPrice = 0 } = req.body;

    if (!propertyId || !roomId || !foodId) {
      return res.status(400).json({
        success: false,
        message: "propertyId, roomId and foodId are required",
      });
    }

    // 1. Get food
    const food = await Food.findById(foodId);

    if (!food || !food.isAvailable) {
      return res.status(404).json({
        success: false,
        message: "Food not available",
      });
    }

    // 2. Calculate price
    const basePrice = food.price;
    const finalPrice = basePrice + extraPrice;

    // 3. Create assignment
    const assignment = await PropertyRoomFood.create({
      propertyId,
      roomId,
      restaurantId: food.restaurantId,
      foodId,
      basePrice,
      extraPrice,
      finalPrice,
    });

    return res.status(201).json({
      success: true,
      message: "Food assigned to room successfully",
      data: assignment,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Food already assigned to this room",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



export const getSpecificRoomOrders = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    const orders = await PropertyRoomFood.find({ roomId })
      .populate({
        path: "foodId",
        select: "title description category images",
      })
      .populate({
        path: "restaurantId",
        select: "name location contactNumber",
      })
      // .populate({
      //   path: "propertyRoomFoodId",
      //   select: "finalPrice",
      // })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};