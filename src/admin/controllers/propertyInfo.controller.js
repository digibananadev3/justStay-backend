// src/admin/controllers/propertyInfo.controller.js
import Property from '../../models/property.model.js';
import { handleError } from '../../utils/errorHandler.js';

// Get all properties with pagination and filters
export const getAllProperties = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      propertyType = ''
    } = req.query;

    const query = {};
    
    // Build search query
    if (search) {
      query.$or = [
        { 'basicPropertyDetails.name': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Add property type filter
    if (propertyType) {
      query.propertyType = propertyType;
    }

    // Get total count
    const total = await Property.countDocuments(query);

    // Get paginated results
    const properties = await Property.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('basicPropertyDetails.name location.city status propertyType createdAt')
      .lean();

    // Format response to match UI
    const formattedProperties = properties.map(property => ({
      id: property._id,
      name: property.basicPropertyDetails?.name || 'N/A',
      location: property.location?.city || 'N/A',
      status: property.status || 'Draft',
      type: property.propertyType || 'N/A',
      createdAt: property.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        properties: formattedProperties,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching properties:', error);
    return handleError(res, error, 'Error fetching properties');
  }
};

// Update property status
export const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Draft', 'Under Review', 'Published', 'Rejected', 'Inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedProperty) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: updatedProperty._id,
        status: updatedProperty.status
      }
    });

  } catch (error) {
    console.error('Error updating property status:', error);
    return handleError(res, error, 'Error updating property status');
  }
};

// Delete property
export const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedProperty = await Property.findByIdAndDelete(id);

    if (!deletedProperty) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting property:', error);
    return handleError(res, error, 'Error deleting property');
  }
};

// Get property details by ID
export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id).lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(200).json({
      success: true,
      data: property
    });

  } catch (error) {
    console.error('Error fetching property details:', error);
    return handleError(res, error, 'Error fetching property details');
  }
};
