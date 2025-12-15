import PropertyListType from '../../models/propertyListType.model.js';
import PropertyType from '../../models/propertyType.model.js';

// Get all property list types
export const getPropertyListTypes = async (req, res) => {
  try {
    const { propertyTypeId, isActive } = req.query;
    const query = {};

    if (propertyTypeId) query.propertyTypeId = propertyTypeId;
    if (isActive === 'true' || isActive === 'false') query.isActive = isActive === 'true';

    const items = await PropertyListType.find(query)
      .populate('propertyTypeId', 'name')
      .sort({ PropertyListTypeName: 1 })
      .lean();

    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching property list types:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch property list types', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

// Get one by id
export const getPropertyListTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await PropertyListType.findById(id).populate('propertyTypeId', 'name');
    if (!item) return res.status(404).json({ success: false, message: 'Property list type not found' });
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching property list type:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch property list type', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

// Create
export const createPropertyListType = async (req, res) => {
  try {
    const { propertyTypeId, PropertyListTypeName, description, icon } = req.body;

    
    // uniqueness per type + name (case-insensitive)
    const existing = await PropertyListType.findOne({
      propertyTypeId,
      PropertyListTypeName: { $regex: new RegExp(`^${PropertyListTypeName}$`, 'i') }
    });
    if (existing) return res.status(400).json({ success: false, message: 'PropertyListTypeName already exists for this property type' });

    const created = await PropertyListType.create({ propertyTypeId, PropertyListTypeName, description, icon });
    const populated = await created.populate('propertyTypeId', 'name');

    return res.status(201).json({ success: true, message: 'Created successfully', data: populated });
  } catch (error) {
    console.error('Error creating property list type:', error);
    return res.status(500).json({ success: false, message: 'Failed to create property list type', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

// Update
export const updatePropertyListType = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyTypeId, PropertyListTypeName, description, icon, isActive } = req.body;

    const item = await PropertyListType.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Property list type not found' });

    if (propertyTypeId) {
      const type = await PropertyType.findById(propertyTypeId);
      if (!type) return res.status(400).json({ success: false, message: 'Invalid propertyTypeId' });
      item.propertyTypeId = propertyTypeId;
    }

    if (PropertyListTypeName && PropertyListTypeName !== item.PropertyListTypeName) {
      const dup = await PropertyListType.findOne({
        propertyTypeId: propertyTypeId || item.propertyTypeId,
        PropertyListTypeName: { $regex: new RegExp(`^${PropertyListTypeName}$`, 'i') },
        _id: { $ne: id }
      });
      if (dup) return res.status(400).json({ success: false, message: 'PropertyListTypeName already exists for this property type' });
      item.PropertyListTypeName = PropertyListTypeName;
    }

    if (description !== undefined) item.description = description;
    if (icon !== undefined) item.icon = icon;
    if (isActive !== undefined) item.isActive = isActive;

    await item.save();
    const populated = await item.populate('propertyTypeId', 'name');

    return res.status(200).json({ success: true, message: 'Updated successfully', data: populated });
  } catch (error) {
    console.error('Error updating property list type:', error);
    return res.status(500).json({ success: false, message: 'Failed to update property list type', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

// Delete (hard delete per your current preference)
export const deletePropertyListType = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await PropertyListType.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Property list type not found' });

    await PropertyListType.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting property list type:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete property list type', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};
