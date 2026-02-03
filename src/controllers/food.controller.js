import { Food, PropertyFood, Restaurant } from "../models/food.model.js";


/* =========================
   CREATE RESTAURANT
========================= */
export const createRestaurant = async (req, res) => {
  try {
    const { name, status, location, contactNumber, email } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Restaurant name is required"
      });
    }

    if (!location) {
      return res.status(400).json({
        success: false,
        message: "Location is required"
      });
    }

    if (!contactNumber) {
      return res.status(400).json({
        success: false,
        message: "Contact number is required"
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const restaurant = await Restaurant.create({
      name,
      status,
      location,
      contactNumber,
      email
    });

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
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




export const assignFood = async (req, res) => {
  const { propertyId, restaurantId, foodId, availableStock, price } = req.body;

  if (availableStock <= 0) {
    return res.status(400).json({ message: "availableStock must be greater than 0" });
  }

    if(!restaurantId){
    return res.status(400).json({ message: "restaurantId is required" });
  }
  if(!propertyId){
    return res.status(400).json({ message: "propertyId is required" });
  }
  if(price === undefined){
    return res.status(400).json({ message: "price is required" });
  }


  const food = await Food.findOneAndUpdate(
    { _id: foodId, totalStock: { $gte: availableStock } },
    { $inc: { totalStock: -availableStock } },
    { new: true }
  );

  if (!food) {
    return res.status(400).json({ message: "Not enough global stock" });
  }


  try {
    const stock = await PropertyFood.create({
      propertyId,
      restaurantId,
      foodId,
      availableStock,
      price
    });

  return res.status(201).json(stock);
} catch (err) {
  if (err.code === 11000) {
    return res.status(400).json({ message: "Food already assigned to this restaurant" });
  }
  throw err;
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
  const stock = await PropertyFood.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(stock);
};

export const removeFood = async (req, res) => {
  await PropertyFood.findByIdAndDelete(req.params.id);
  res.json({ message: "Removed" });
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

