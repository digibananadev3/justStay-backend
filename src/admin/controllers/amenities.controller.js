import Amenity from '../../models/amenity.model.js';

const normalizeAmenity = (a) => ({
  _id: a?._id || null,
  name: a?.name || '',
  category: a?.category || 'room',
  icon: a?.icon || '',
  isActive: a?.isActive !== false,
  createdAt: a?.createdAt || null,
  updatedAt: a?.updatedAt || null,
});

export const listAmenities = async (req, res) => {
  try {
    const { category = '', search, page = 1, limit = 200, onlyActive } = req.query;
        // const { category = '', search, page = 1, limit = 200, onlyActive } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (onlyActive === 'true') filter.isActive = true;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [rows, total] = await Promise.all([
      Amenity.find(filter).sort({ name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      Amenity.countDocuments(filter),
    ]);


    const data = rows.map(normalizeAmenity);
    return res.status(200).json({ success: true, data, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
    // return res.status(200).json({success: true, data, pagination: })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const seedRoomAmenities = async (req, res) => {
  try {
    const defaults = [
      'Air-Conditioning',
      'Laundry',
      'Newspaper',
      'Parking',
      'Room service',
      'Smoke Detector',
      'Smoking Rooms',
      'Swimming Pool',
      'Wifi',
      'Lounge'
    ];

    const existing = await Amenity.find({ name: { $in: defaults }, category: 'room' }).select('name').lean();
    const existingSet = new Set(existing.map((e) => e.name));

    const toInsert = defaults
      .filter((n) => !existingSet.has(n))
      .map((name) => ({ name, category: 'room', isActive: true }));

    if (toInsert.length > 0) await Amenity.insertMany(toInsert);

    const rows = await Amenity.find({ category: 'room' }).sort({ name: 1 }).lean();
    return res.status(201).json({ success: true, message: 'Amenities seeded', inserted: toInsert.length, data: rows.map(normalizeAmenity) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};


export const createAmenity = async (req, res) => {
  try {
    const { name, category = "room", icon = "", isActive = true } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Amenity name is required",
      });
    }

    // Check duplicate (same name + category)
    const existing = await Amenity.findOne({
      name: name.trim(),
      category,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Amenity already exists in this category",
      });
    }

    const amenity = await Amenity.create({
      name: name.trim(),
      category,
      icon,
      isActive,
    });

    return res.status(201).json({
      success: true,
      message: "Amenity created successfully",
      data: normalizeAmenity(amenity),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


export const updateAmenity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, icon, isActive } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Amenity ID is required",
      });
    }

    const amenity = await Amenity.findById(id);

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: "Amenity not found",
      });
    }

    // Prevent duplicate name + category
    if (name || category) {
      const duplicate = await Amenity.findOne({
        _id: { $ne: id },
        name: name ?? amenity.name,
        category: category ?? amenity.category,
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Amenity with same name already exists in this category",
        });
      }
    }

    // Update only provided fields
    if (typeof name === "string") amenity.name = name.trim();
    if (typeof category === "string") amenity.category = category.trim();
    if (typeof icon === "string") amenity.icon = icon.trim();
    if (typeof isActive === "boolean") amenity.isActive = isActive;

    await amenity.save();

    return res.status(200).json({
      success: true,
      message: "Amenity updated successfully",
      data: normalizeAmenity(amenity),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


export const deleteAmenity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Amenity ID is required",
      });
    }

    const amenity = await Amenity.findById(id);

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: "Amenity not found",
      });
    }


    if(amenity?.isActive === false){
      return res.status(400).json({
        success : true,
        message : "Amenity already deleted"
      });
    }

    // Soft delete
    amenity.isActive = false;
    await amenity.save();

    return res.status(200).json({
      success: true,
      message: "Amenity deleted successfully",
      data: normalizeAmenity(amenity),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



export const fetchAmenitiesStats = async (req, res) => {
  try {
    const total = await Amenity.countDocuments({});
    const active = await Amenity.countDocuments({ isActive: true });
    const inactive = await Amenity.countDocuments({ isActive: false });

    const roomAmenities = await Amenity.countDocuments({ category: "room" });
    const propertyAmenities = await Amenity.countDocuments({ category: "property" });

    const activeRoomAmenities = await Amenity.countDocuments({
      category: "room",
      isActive: true,
    });

    const activePropertyAmenities = await Amenity.countDocuments({
      category: "property",
      isActive: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        totalAmenities: total,
        activeAmenities: active,
        inactiveAmenities: inactive,
        roomAmenities,
        propertyAmenities,
        activeRoomAmenities,
        activePropertyAmenities,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
