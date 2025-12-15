// src/utils/propertyUtils.js
import Review from '../models/review.model.js';
import PropertyRoom from '../models/propertyRoom.model.js';

// Calculate average ratings for multiple properties
export const calculatePropertyRatings = async (propertyIds) => {
  try {
    const ratings = await Review.aggregate([
      { $match: { propertyId: { $in: propertyIds } } },
      { 
        $group: {
          _id: '$propertyId',
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);
    
    return ratings.reduce((acc, { _id, averageRating, totalRatings }) => {
      acc[_id.toString()] = {
        rating: parseFloat(averageRating.toFixed(1)),
        totalRatings
      };
      return acc;
    }, {});
  } catch (error) {
    console.error('Error calculating ratings:', error);
    return {};
  }
};

// Get room counts for multiple properties
export const getPropertyRoomCounts = async (propertyIds) => {
  try {
    const counts = await PropertyRoom.aggregate([
      { $match: { propertyId: { $in: propertyIds } } },
      { $group: { _id: '$propertyId', roomCount: { $sum: 1 } } }
    ]);
    return counts.reduce((acc, { _id, roomCount }) => {
      acc[_id.toString()] = roomCount;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error getting room counts:', error);
    return {};
  }
};

// Get properties with specific amenities
export const getPropertiesByAmenities = async (amenities = [], limit = 4) => {
  try {
    const rooms = await PropertyRoom.aggregate([
      {
        $match: {
          amenities: { $in: Array.isArray(amenities) ? amenities : [amenities] }
        }
      },
      {
        $group: {
          _id: '$propertyId',
          matchingAmenities: { $sum: 1 }
        }
      },
      { $sort: { matchingAmenities: -1 } },
      { $limit: limit }
    ]);

    if (rooms.length === 0) return [];

    const propertyIds = rooms.map(r => r._id);
    return await Property.find({ _id: { $in: propertyIds } }).lean();
  } catch (error) {
    console.error('Error getting properties by amenities:', error);
    return [];
  }
};