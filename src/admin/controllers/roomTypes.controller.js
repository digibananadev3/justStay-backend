import RoomType from '../../models/roomType.model.js';

const normalize = (r) => ({
  _id: r?._id || null,
  name: r?.name || '',
  description: r?.description || '',
  icon: r?.icon || '',
  order: typeof r?.order === 'number' ? r.order : 0,
  isActive: r?.isActive !== false,
  createdAt: r?.createdAt || null,
  updatedAt: r?.updatedAt || null,
});

export const listRoomTypes = async (req, res) => {
  try {
    const { search, onlyActive, page = 1, limit = 200 } = req.query;
    const filter = {};
    if (onlyActive === 'true') filter.isActive = true;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [rows, total] = await Promise.all([
      RoomType.find(filter).sort({ order: 1, name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      RoomType.countDocuments(filter),
    ]);

    const data = rows.map(normalize);
    return res.status(200).json({ success: true, data, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const seedRoomTypes = async (req, res) => {
  try {
    const defaults = [
      { name: 'Deluxe room', order: 1 },
      { name: 'Super Deluxe room', order: 2 },
      { name: 'President Suite', order: 3 }
    ];

    const existing = await RoomType.find({ name: { $in: defaults.map(d => d.name) } }).select('name').lean();
    const set = new Set(existing.map(e => e.name));
    const toInsert = defaults.filter(d => !set.has(d.name));
    if (toInsert.length) await RoomType.insertMany(toInsert);

    const rows = await RoomType.find({}).sort({ order: 1, name: 1 }).lean();
    return res.status(201).json({ success: true, message: 'Room types seeded', inserted: toInsert.length, data: rows.map(normalize) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
