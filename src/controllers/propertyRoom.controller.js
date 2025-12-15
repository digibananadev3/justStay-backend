import PropertyRoom from "../models/propertyRoom.model.js";

// ✅ Create a new room
export const createRoom = async (req, res) => {
  try {
    
    const data = req.body;
    
    if (!data.userId) {
      return res.status(400).json({ status: "error", message: "userId is required" });
    }   

    if (!data.propertyId) {
      return res.status(400).json({ status: "error", message: "propertyId is required" });
    }

    // normalize roomNumbers if provided
    if (Array.isArray(data.roomNumbers)) {
      const unique = Array.from(new Set(data.roomNumbers.map(String).map((s) => s.trim()).filter(Boolean)));
      data.roomNumbers = unique;
      if (!data.numberOfRooms) data.numberOfRooms = unique.length || 1;
    }

    const room = await PropertyRoom.create(data);

    res.status(201).json({
      status: "success",
      message: "Room created successfully",
      room,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({  status: "error", message: "Server error", error: error.message });
  }
};

// ================================
// Pricing & Promotions
// ================================

export const getRoomPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await PropertyRoom.findById(id).select("price discounts promo");
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error("Error getting pricing:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateRoomPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { price, discounts, promo } = req.body;

    const payload = {};
    if (price) {
      payload["price.oneNight"] = typeof price.oneNight === "number" ? price.oneNight : undefined;
      payload["price.threeHours"] = typeof price.threeHours === "number" ? price.threeHours : undefined;
      payload["price.sixHours"] = typeof price.sixHours === "number" ? price.sixHours : undefined;
    }
    if (discounts) {
      payload["discounts.oneNightPercent"] = typeof discounts.oneNightPercent === "number" ? discounts.oneNightPercent : undefined;
      payload["discounts.threeHoursPercent"] = typeof discounts.threeHoursPercent === "number" ? discounts.threeHoursPercent : undefined;
      payload["discounts.sixHoursPercent"] = typeof discounts.sixHoursPercent === "number" ? discounts.sixHoursPercent : undefined;
    }
    if (promo) {
      if (typeof promo.code !== "undefined") payload["promo.code"] = promo.code;
      if (typeof promo.discountPercent === "number") payload["promo.discountPercent"] = promo.discountPercent;
      if (typeof promo.validFrom !== "undefined") payload["promo.validFrom"] = promo.validFrom;
      if (typeof promo.validTo !== "undefined") payload["promo.validTo"] = promo.validTo;
      if (typeof promo.isActive === "boolean") payload["promo.isActive"] = promo.isActive;
    }

    // remove undefined keys
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const updated = await PropertyRoom.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).select(
      "price discounts promo"
    );
    if (!updated) return res.status(404).json({ success: false, message: "Room not found" });
    res.status(200).json({ success: true, message: "Pricing & promotions updated", data: updated });
  } catch (error) {
    console.error("Error updating pricing:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateRoomPricePartial = async (req, res) => {
  try {
    const { id } = req.params;
    const { oneNight, threeHours, sixHours } = req.body;
    const payload = {};
    if (typeof oneNight === "number") payload["price.oneNight"] = oneNight;
    if (typeof threeHours === "number") payload["price.threeHours"] = threeHours;
    if (typeof sixHours === "number") payload["price.sixHours"] = sixHours;

    const updated = await PropertyRoom.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).select(
      "price"
    );
    if (!updated) return res.status(404).json({ success: false, message: "Room not found" });
    res.status(200).json({ success: true, message: "Price updated", data: updated.price });
  } catch (error) {
    console.error("Error updating room price:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateRoomDiscounts = async (req, res) => {
  try {
    const { id } = req.params;
    const { oneNightPercent, threeHoursPercent, sixHoursPercent } = req.body;
    const payload = {};
    if (typeof oneNightPercent === "number") payload["discounts.oneNightPercent"] = oneNightPercent;
    if (typeof threeHoursPercent === "number") payload["discounts.threeHoursPercent"] = threeHoursPercent;
    if (typeof sixHoursPercent === "number") payload["discounts.sixHoursPercent"] = sixHoursPercent;

    const updated = await PropertyRoom.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).select(
      "discounts"
    );
    if (!updated) return res.status(404).json({ success: false, message: "Room not found" });
    res.status(200).json({ success: true, message: "Discounts updated", data: updated.discounts });
  } catch (error) {
    console.error("Error updating discounts:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateRoomPromo = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountPercent, validFrom, validTo, isActive } = req.body;
    const payload = {};
    if (typeof code !== "undefined") payload["promo.code"] = code;
    if (typeof discountPercent === "number") payload["promo.discountPercent"] = discountPercent;
    if (typeof validFrom !== "undefined") payload["promo.validFrom"] = validFrom;
    if (typeof validTo !== "undefined") payload["promo.validTo"] = validTo;
    if (typeof isActive === "boolean") payload["promo.isActive"] = isActive;

    const updated = await PropertyRoom.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).select(
      "promo"
    );
    if (!updated) return res.status(404).json({ success: false, message: "Room not found" });
    res.status(200).json({ success: true, message: "Promo updated", data: updated.promo });
  } catch (error) {
    console.error("Error updating promo:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const bulkUpdateRoomPricing = async (req, res) => {
  try {
    const { roomIds = [], price, discounts } = req.body;
    if (!Array.isArray(roomIds) || roomIds.length === 0) {
      return res.status(400).json({ success: false, message: "roomIds is required" });
    }
    const filter = { _id: { $in: roomIds } };
    const $set = {};
    if (price) {
      if (typeof price.oneNight === "number") $set["price.oneNight"] = price.oneNight;
      if (typeof price.threeHours === "number") $set["price.threeHours"] = price.threeHours;
      if (typeof price.sixHours === "number") $set["price.sixHours"] = price.sixHours;
    }
    if (discounts) {
      if (typeof discounts.oneNightPercent === "number") $set["discounts.oneNightPercent"] = discounts.oneNightPercent;
      if (typeof discounts.threeHoursPercent === "number") $set["discounts.threeHoursPercent"] = discounts.threeHoursPercent;
      if (typeof discounts.sixHoursPercent === "number") $set["discounts.sixHoursPercent"] = discounts.sixHoursPercent;
    }
    const result = await PropertyRoom.updateMany(filter, { $set });
    res.status(200).json({ success: true, message: "Bulk update applied", data: { matched: result.matchedCount ?? result.n, modified: result.modifiedCount ?? result.nModified } });
  } catch (error) {
    console.error("Error bulk updating pricing:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

//Update a room by ID
export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // optional normalization for roomNumbers
    if (Array.isArray(data.roomNumbers)) {
      const unique = Array.from(new Set(data.roomNumbers.map(String).map((s) => s.trim()).filter(Boolean)));
      data.roomNumbers = unique;
      if (!data.numberOfRooms && unique.length > 0) data.numberOfRooms = unique.length;
    }

    const updatedRoom = await PropertyRoom.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!updatedRoom) {
      return res.status(404).json({ status: "error", message: "Room not found" });
    }

    res.status(200).json({
        status: "success",
      message: "Room updated successfully",
      room: updatedRoom,
    });
  } catch (error) {
    console.error("Error updating room:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all rooms (optionally by propertyId)
export const getAllRooms = async (req, res) => {
  try {
    const { propertyId } = req.query;
    const query = propertyId ? { propertyId } : {};
    const rooms = await PropertyRoom.find(query);
    res.status(200).json({
      success: true,
      count: rooms.length,
      message: rooms.length
        ? "Rooms fetched successfully"
        : "No rooms found",
      data: rooms,
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ✅ Get Room by ID
export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await PropertyRoom.findById(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Room details fetched successfully",
      data: room,
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching room details",
      error: error.message,
    });
  }
};

// ✅ Delete Room by ID
export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await PropertyRoom.findByIdAndDelete(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting room",
      error: error.message,
    });
  }
};
