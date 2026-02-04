import mongoose from "mongoose";
import { Food, PropertyFood, Restaurant, RoomFood } from "../models/food.model.js";



/* =========================
   CREATE RESTAURANT
========================= */
export const createRestaurant = async (req, res) => {
  try {
    const { name, location, contactNumber, email, status } = req.body;

    if (!name || !location || !contactNumber || !email) {
      return res.status(400).json({
        success: false,
        message: "Name, location, contactNumber and email are required"
      });
    }

    const restaurant = await Restaurant.create({
      name,
      location,
      contactNumber,
      email,
      status: status || "active"
    });

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      data: restaurant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/* =========================
   GET ALL RESTAURANTS
========================= */
export const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  } 
};


/* =========================
   DELETE RESTAURANT
========================= */
export const deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found"
      });
    }

    await restaurant.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Restaurant deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/* =========================
   GET SPECIFIC RESTAURANT
========================= */
export const getSpecificRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/* =========================
   CREATE FOOD (GLOBAL)
========================= */
export const createFood = async (req, res) => {
  try {
    const { title, category, totalStock, images } = req.body;

    if (!title || !category || totalStock === undefined) {
      return res.status(400).json({
        success: false,
        message: "Title, category and totalStock are required"
      });
    }

     if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one food image is required"
      });
    }

    const food = await Food.create({
      title,
      category,
      totalStock,
      images 
    });

    return res.status(201).json({
      success: true,
      message: "Food created successfully",
      data: food
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* =========================
   GET ALL FOODS
========================= */
export const getAllFoods = async (req, res) => {
  try {
    const foods = await Food.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: foods.length,
      data: foods
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/* ==========================
   GET FOOD BY ID
========================= */
export const getFoodById = async (req, res) => {
  try {
    const { id } = req.params;
    const food = await Food.findById(id);

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: food
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/* =========================
   DELETE FOOD (SAFE)
========================= */
export const deleteFood = async (req, res) => {
  try {
    const { id } = req.params;

    const food = await Food.findById(id);
    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food not found"
      });
    }

    // ❗ Prevent deleting food if allocated to any restaurant
    const allocated = await PropertyFood.findOne({ foodId: id });
    if (allocated) {
      return res.status(400).json({
        success: false,
        message: "Food is allocated to a restaurant and cannot be deleted"
      });
    }

    await food.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Food deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




// export const assignFood = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { propertyId, restaurantId, foodId, availableStock, price } = req.body;

//    if (!propertyId || !restaurantId || !foodId || availableStock <= 0 || price === undefined) {
//       return res.status(400).json({ message: "All fields required" });
//     }

//     // 1️⃣ Reduce global stock
//     const food = await Food.findOneAndUpdate(
//       { _id: foodId, totalStock: { $gte: availableStock } },
//       { $inc: { totalStock: -availableStock } },
//       { new: true, session }
//     );

//     if (!food) {
//       await session.abortTransaction();
//       return res.status(400).json({ message: "Not enough global stock" });
//     }

//     // 2️⃣ Assign to restaurant
//     const stock = await PropertyFood.create(
//       [
//         {
//           propertyId,
//           restaurantId,
//           foodId,
//           availableStock,
//           price
//         }
//       ],
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json(stock[0]);
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();

//     if (err.code === 11000) {
//       return res.status(400).json({ message: "Food already assigned" });
//     }

//     res.status(500).json({ message: err.message });
//   }
// };
export const assignFood = async (req, res) => {
  const { propertyId, restaurantId, foodId, availableStock, price } = req.body;

  if (!propertyId || !restaurantId || !foodId || availableStock <= 0 || price === undefined) {
    return res.status(400).json({ message: "All fields required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const food = await Food.findOneAndUpdate(
      { _id: foodId, totalStock: { $gte: availableStock } },
      { $inc: { totalStock: -availableStock } },
      { new: true, session }
    );

    if (!food) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Not enough global stock" });
    }

    const stock = await PropertyFood.create(
      [
        { propertyId, restaurantId, foodId, availableStock, price }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(stock[0]);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000) {
      return res.status(400).json({ message: "Food already assigned" });
    }

    res.status(500).json({ message: err.message });
  }
};



export const getSpecificPropertyFood = async (req, res) => {
  try{
    const { id } = req.params;
    const propertyFood = await PropertyFood.find({ propertyId: id })
    .populate({
        path: "propertyId",
        select: "basicPropertyDetails.name location.area location.city"
      })
      .populate({
        path: "restaurantId",
        select: "name location contactNumber"
      })
      .populate({
        path: "foodId",
        select: "title category images"
      });
    if (!propertyFood) {
      return res.status(404).json({
        success: false,
        message: "PropertyFood not found"
      });
    }
    return res.status(200).json({
      success: true,
      data: propertyFood
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const getRestaurantStock = async (req, res) => {
  const data = await PropertyFood.find({ restaurantId: req.params.restaurantId })
    .populate("foodId");
  res.json(data);
};


// export const getSpecificPropertyFood = async (req, res) => {
//   try{
//     const { id } = req.params;
//     const propertyFood = await PropertyFood.findById(id).populate("foodId");

//     if (!propertyFood) {
//       return res.status(404).json({
//         success: false,
//         message: "PropertyFood not found"
//       });
//     }
//     return res.status(200).json({
//       success: true,
//       data: propertyFood
//     });

//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

export const updateStock = async (req, res) => {

  if (req.body.availableStock < 0) {
  return res.status(400).json({ message: "Stock cannot be negative" });
}


  const stock = await PropertyFood.findOneAndUpdate(
    {
      _id: req.params.id,
      availableStock: { $gte: 0 }
    },
    req.body,
    { new: true }
  );

  if (!stock) {
    return res.status(400).json({ message: "Invalid stock update" });
  }

  res.json(stock);
};


/* =========================
  REMOVE FOOD FROM RESTAURANT & RESTORE STOCK
========================= */
export const removeFood = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const item = await PropertyFood.findById(req.params.id).session(session);
    if (!item) return res.status(404).json({ message: "Not found" });

    // Restore global stock
    await Food.findByIdAndUpdate(
      item.foodId,
      { $inc: { totalStock: item.availableStock } },
      { session }
    );

    await item.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Removed & stock restored" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};




// Create Room Food Order
export const createRoomFoodOrder = async (req, res) => {
  const { roomId, propertyId, restaurantId, foodId, quantity } = req.body;

  if (!roomId || !propertyId || !restaurantId || !foodId || !quantity) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const stock = await PropertyFood.findOneAndUpdate(
      {
        propertyId,
        restaurantId,
        foodId,
        availableStock: { $gte: quantity }
      },
      { $inc: { availableStock: -quantity, usedStock: quantity } },
      { new: true, session }
    );

    if (!stock) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Not enough stock" });
    }

    const order = await RoomFood.create(
      [
        { roomId, propertyId, restaurantId, foodId, quantity }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Food ordered successfully",
      data: order[0]
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};






// export const createRoomFoodOrder = async (req, res) => {
//   try {
//     const { roomBookingId, restaurantId, foodId, quantity } = req.body;
//     if (!roomBookingId || !restaurantId || !foodId || !quantity) {
//       return res.status(400).json({
//         success: false,
//         message: "roomBookingId, restaurantId, foodId and quantity are required"
//       });
//     }
//     const roomFoodOrder = await RoomFood.create({
//       roomBookingId,
//       restaurantId,
//       foodId,
//       quantity
//     });

