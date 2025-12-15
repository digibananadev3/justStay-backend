import PropertyType from '../../models/propertyType.model.js';

// Get property type by ID
export const getPropertyTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const propertyType = await PropertyType.findById(id);
    
    if (!propertyType) {
      return res.status(404).json({
        success: false,
        message: 'Property type not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: propertyType
    });
  } catch (error) {
    console.error('Error fetching property type:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch property type',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all property types
export const getPropertyTypes = async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};
    
    if (isActive === 'true' || isActive === 'false') {
      query.isActive = isActive === 'true';
    }
    
    const propertyTypes = await PropertyType.find(query).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      data: propertyTypes
    });
  } catch (error) {
    console.error('Error fetching property types:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch property types',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add a new property type
export const addPropertyType = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Property type name is required'
      });
    }

    // Check if type already exists (case-insensitive)
    const existingType = await PropertyType.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingType) {
      return res.status(400).json({
        success: false,
        message: 'Property type already exists'
      });
    }

    const newPropertyType = await PropertyType.create({
      name,
      description,
      icon
    });

    res.status(201).json({
      success: true,
      message: 'Property type created successfully',
      data: newPropertyType
    });
  } catch (error) {
    console.error('Error adding property type:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add property type',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update a property type
export const updatePropertyType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, isActive } = req.body;

    // Check if the property type exists
    const existingType = await PropertyType.findById(id);
    if (!existingType) {
      return res.status(404).json({
        success: false,
        message: 'Property type not found'
      });
    }

    // If name is being updated, check for duplicates
    if (name && name !== existingType.name) {
      const duplicate = await PropertyType.findOne({ 
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });
      
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Property type with this name already exists'
        });
      }
    }

    // Update the property type
    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (description !== undefined) updatedFields.description = description;
    if (icon !== undefined) updatedFields.icon = icon;
    if (isActive !== undefined) updatedFields.isActive = isActive;

    const updatedType = await PropertyType.findByIdAndUpdate(
      id,
      { $set: updatedFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Property type updated successfully',
      data: updatedType
    });
  } catch (error) {
    console.error('Error updating property type:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update property type',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a property type
export const deletePropertyType = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the property type exists
    const propertyType = await PropertyType.findById(id);
    if (!propertyType) {
      return res.status(404).json({
        success: false,
        message: 'Property type not found'
      });
    }

    // Delete the property type
    await PropertyType.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Property type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting property type:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete property type',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
