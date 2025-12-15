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
    const { category = 'room', search, page = 1, limit = 200, onlyActive } = req.query;
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
