import PropertyRoom from "../models/propertyRoom.model.js";
import RoomInventory from "../models/roomInventory.model.js";
import RoomBooking from "../models/roomBooking.model.js"
import { updatePropertyPricing } from "./property.controller.js";




// ================================
// CREATE ROOM
// ================================
export const createRoom = async (req, res) => {
  try {
    const data = req.body;

    if (!data.userId)
      return res.status(400).json({ status: "error", message: "userId is required" });

    if (!data.propertyId)
      return res.status(400).json({ status: "error", message: "propertyId is required" });

    // normalize roomNumbers
    if (Array.isArray(data.roomNumbers)) {
      data.roomNumbers = Array.from(
        new Set(data.roomNumbers.map(String).map((s) => s.trim()).filter(Boolean))
      );
    }

    // numberOfRooms removed from schema — derive from roomNumbers.length if accidentally sent
    delete data.numberOfRooms;

    const room = await PropertyRoom.create(data);
    await updatePropertyPricing(room.propertyId);

    res.status(201).json({ status: "success", message: "Room created successfully", room });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ status: "error", message: "Server error", error: error.message });
  }
};



// ================================
// Pricing & Promotions
// ================================
export const getRoomPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await PropertyRoom.findById(id).select("pricing discounts promo propertyId");
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error("Error getting pricing:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// ================================
//   UPDATE ROOM PRICING
// ================================
export const updateRoomPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { pricing, discounts, promo } = req.body;

    const payload = {};

    // All 5 plan types
    const stayTypes = ["oneNight", "threeHours", "sixHours", "dateToDate", "openStay"];

    if (pricing) {
      stayTypes.forEach((stay) => {
        if (pricing[stay]) {
          if (typeof pricing[stay].roomOnly === "number")
            payload[`pricing.${stay}.roomOnly`] = pricing[stay].roomOnly;
          if (typeof pricing[stay].withBreakfast === "number")
            payload[`pricing.${stay}.withBreakfast`] = pricing[stay].withBreakfast;
        }
      });
    }

    if (discounts) {
      const discountFields = [
        "oneNightPercent",
        "threeHoursPercent",
        "sixHoursPercent",
        "dateToDatePercent",
        "openStayPercent",
      ];
      discountFields.forEach((field) => {
        if (typeof discounts[field] === "number")
          payload[`discounts.${field}`] = discounts[field];
      });
    }

    if (promo) {
      if (typeof promo.code !== "undefined")            payload["promo.code"] = promo.code;
      if (typeof promo.discountPercent === "number")    payload["promo.discountPercent"] = promo.discountPercent;
      if (typeof promo.validFrom !== "undefined")       payload["promo.validFrom"] = promo.validFrom;
      if (typeof promo.validTo !== "undefined")         payload["promo.validTo"] = promo.validTo;
      if (typeof promo.isActive === "boolean")          payload["promo.isActive"] = promo.isActive;
    }

    // remove undefined keys
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const updated = await PropertyRoom.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true, runValidators: true }
    ).select("pricing discounts promo");

    if (!updated) return res.status(404).json({ success: false, message: "Room not found" });

    await updatePropertyPricing(updated.propertyId);

    res.status(200).json({ success: true, message: "Pricing & promotions updated", data: updated });
  } catch (error) {
    console.error("Error updating pricing:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



// export const updateRoomPricePartial = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { oneNight, threeHours, sixHours } = req.body;
//     const payload = {};
//     if (typeof oneNight === "number") payload["price.oneNight"] = oneNight;
//     if (typeof threeHours === "number") payload["price.threeHours"] = threeHours;
//     if (typeof sixHours === "number") payload["price.sixHours"] = sixHours;

//     const updated = await PropertyRoom.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).select(
//       "pricing"
//     );
//     if (!updated) return res.status(404).json({ success: false, message: "Room not found" });
//     res.status(200).json({ success: true, message: "Price updated", data: updated.pricing });
//   } catch (error) {
//     console.error("Error updating room price:", error);
//     res.status(500).json({ success: false, message: "Server error", error: error.message });
//   }
// };

export const updateRoomDiscounts = async (req, res) => {
  try {
    const { id } = req.params;
    const { oneNightPercent, threeHoursPercent, sixHoursPercent, dateToDatePercent, openStayPercent } = req.body;

    const payload = {};
    if (typeof oneNightPercent === "number")    payload["discounts.oneNightPercent"] = oneNightPercent;
    if (typeof threeHoursPercent === "number")  payload["discounts.threeHoursPercent"] = threeHoursPercent;
    if (typeof sixHoursPercent === "number")    payload["discounts.sixHoursPercent"] = sixHoursPercent;
    if (typeof dateToDatePercent === "number")  payload["discounts.dateToDatePercent"] = dateToDatePercent;
    if (typeof openStayPercent === "number")    payload["discounts.openStayPercent"] = openStayPercent;

    const updated = await PropertyRoom.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true, runValidators: true }
    ).select("discounts");

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
    if (typeof code !== "undefined")              payload["promo.code"] = code;
    if (typeof discountPercent === "number")      payload["promo.discountPercent"] = discountPercent;
    if (typeof validFrom !== "undefined")         payload["promo.validFrom"] = validFrom;
    if (typeof validTo !== "undefined")           payload["promo.validTo"] = validTo;
    if (typeof isActive === "boolean")            payload["promo.isActive"] = isActive;

    const updated = await PropertyRoom.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true, runValidators: true }
    ).select("promo");

    if (!updated) return res.status(404).json({ success: false, message: "Room not found" });

    res.status(200).json({ success: true, message: "Promo updated", data: updated.promo });
  } catch (error) {
    console.error("Error updating promo:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



// export const bulkUpdateRoomPricing = async (req, res) => {
//   try {
//     const { roomIds = [], pricing , discounts } = req.body;

//     if (!Array.isArray(roomIds) || roomIds.length === 0) {
//       return res.status(400).json({ success: false, message: "roomIds is required" });
//     }

//     const filter = { _id: { $in: roomIds } };

//     const $set = {};
//     if (price) {
//       if (typeof price.oneNight === "number") $set["price.oneNight"] = price.oneNight;
//       if (typeof price.threeHours === "number") $set["price.threeHours"] = price.threeHours;
//       if (typeof price.sixHours === "number") $set["price.sixHours"] = price.sixHours;
//     }
//     if (discounts) {
//       if (typeof discounts.oneNightPercent === "number") $set["discounts.oneNightPercent"] = discounts.oneNightPercent;
//       if (typeof discounts.threeHoursPercent === "number") $set["discounts.threeHoursPercent"] = discounts.threeHoursPercent;
//       if (typeof discounts.sixHoursPercent === "number") $set["discounts.sixHoursPercent"] = discounts.sixHoursPercent;
//     }
//     const result = await PropertyRoom.updateMany(filter, { $set });
//     res.status(200).json({ success: true, message: "Bulk update applied", data: { matched: result.matchedCount ?? result.n, modified: result.modifiedCount ?? result.nModified } });
//   } catch (error) {
//     console.error("Error bulk updating pricing:", error);
//     res.status(500).json({ success: false, message: "Server error", error: error.message });
//   }
// };

export const bulkUpdateRoomPricing = async (req, res) => {
  try {
    const { roomIds = [], pricing } = req.body;

    if (!roomIds.length)
      return res.status(400).json({ message: "roomIds required" });

    const stayTypes = ["oneNight", "threeHours", "sixHours", "dateToDate", "openStay"];
    const $set = {};

    if (pricing) {
      stayTypes.forEach((stay) => {
        if (pricing[stay]) {
          if (typeof pricing[stay].roomOnly === "number")
            $set[`pricing.${stay}.roomOnly`] = pricing[stay].roomOnly;
          if (typeof pricing[stay].withBreakfast === "number")
            $set[`pricing.${stay}.withBreakfast`] = pricing[stay].withBreakfast;
        }
      });
    }

    await PropertyRoom.updateMany({ _id: { $in: roomIds } }, { $set });

    const room = await PropertyRoom.findById(roomIds[0]);
    if (room) await updatePropertyPricing(room.propertyId);

    res.json({ success: true, message: "Bulk pricing updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Update a room by ID
export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (Array.isArray(data.roomNumbers)) {
      data.roomNumbers = Array.from(
        new Set(data.roomNumbers.map(String).map((s) => s.trim()).filter(Boolean))
      );
    }

    // numberOfRooms removed from schema
    delete data.numberOfRooms;

    const updatedRoom = await PropertyRoom.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!updatedRoom)
      return res.status(404).json({ status: "error", message: "Room not found" });

    await updatePropertyPricing(updatedRoom.propertyId);

    res.status(200).json({ status: "success", message: "Room updated successfully", room: updatedRoom });
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
      message: rooms.length ? "Rooms fetched successfully" : "No rooms found",
      data: rooms,
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



// ================================
// GET PROPERTY ROOMS AVAILABILITY
// ================================
export const getPropertyRoomsAvailability = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { date } = req.query;                   // Date in YYYY-MM-DD format (UTC)

    if (!date)
      return res.status(400).json({ success: false, message: "date is required" });

    const selectedDate = new Date(`${date}T00:00:00.000Z`);

    // 1 — Get all rooms of property
    const rooms = await PropertyRoom.find({ propertyId }).lean();
    const roomIds = rooms.map((r) => r._id);

    // 2 — Get inventory for those rooms on this date
    const inventories = await RoomInventory.find({
      roomId: { $in: roomIds },
      date: selectedDate,
    }).lean();

    const inventoryMap = new Map();
    inventories.forEach((inv) => inventoryMap.set(String(inv.roomId), inv));

    // 3 — For open-stay: find which rooms are currently occupied
    const activeOpenStays = await RoomBooking.find({
      roomId: { $in: roomIds },
      plan: "open-stay",
      status: "CheckIn",
      actualCheckOutAt: null,
    }).lean();

    const openStayRoomIds = new Set(activeOpenStays.map((b) => String(b.roomId)));

    // 4 — Build response
    const data = rooms.map((room) => {
      const inventory = inventoryMap.get(String(room._id));
      const totalRooms = room.roomNumbers.length; // source of truth

      return {
        roomId:      room._id,
        roomType:    room.type,
        roomNumbers: room.roomNumbers,
        totalRooms,

        availability: {
          allotment:        inventory?.allotment ?? totalRooms,
          open:             inventory?.open ?? true,
          stopSell:         inventory?.stopSell ?? false,
          sellStatus:       inventory?.sellStatus ?? "sellable",
          openStayOccupied: openStayRoomIds.has(String(room._id)),
        },

        // 3hr / 6hr slots
        timeSlots: inventory?.timeBlocks?.map((slot) => ({
          from:       slot.from,
          to:         slot.to,
          plan:       slot.plan,
          status:     slot.isBooked ? "booked" : "available",
          roomNumber: slot.roomNumber || null,
        })) || [],

        // whole night
        nightBlock: inventory?.nightBlock
          ? {
              status:       inventory.nightBlock.isBooked ? "booked" : "available",
              roomNumber:   inventory.nightBlock.roomNumber || null,
              checkOutTime: inventory.nightBlock.checkOutTime || null,
            }
          : { status: "available", roomNumber: null, checkOutTime: null },

        // date-to-date
        dateToDateLock: inventory?.dateToDateLock
          ? {
              status:     inventory.dateToDateLock.isBooked ? "booked" : "available",
              roomNumber: inventory.dateToDateLock.roomNumber || null,
            }
          : { status: "available", roomNumber: null },
      };
    });

    res.status(200).json({ success: true, propertyId, date, rooms: data });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// ✅ Get Room by ID
export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await PropertyRoom.findById(id);

    if (!room)
      return res.status(404).json({ success: false, message: "Room not found" });

    res.status(200).json({ success: true, message: "Room details fetched successfully", data: room });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ✅ Delete Room by ID
// export const deleteRoom = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const room = await PropertyRoom.findByIdAndDelete(id);

//     if (!room) {
//       return res.status(404).json({
//         success: false,
//         message: "Room not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Room deleted successfully",
//     });
//   } catch (error) {
//     console.error("Error deleting room:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while deleting room",
//       error: error.message,
//     });
//   }
// };



// ================================
// DELETE ROOM
// ================================
export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await PropertyRoom.findByIdAndDelete(id);

    if (!room)
      return res.status(404).json({ message: "Room not found" });

    await updatePropertyPricing(room.propertyId);

    res.json({ success: true, message: "Room deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};