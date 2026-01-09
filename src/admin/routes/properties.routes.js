// src/admin/routes/properties.routes.js
import express from 'express';
import { query } from 'express-validator';
import {
  getAllProperties,
  exportProperties,
  getPropertyStats,
  getPropertyById,
  getPropertyRooms,
  getPropertyPhotos,
  getPropertyMediaSummary,
  addPropertyMediaPhotos,
  updatePropertyPhotoStatuses,
  deletePropertyMediaPhoto,
  getPropertyVideos,
  addPropertyVideos,
  deletePropertyVideo,
  getPropertyPerformance,
  // documents
  getPropertyDocumentsSummary,
  getPropertyDocuments,
  addPropertyDocuments,
  updatePropertyDocument,
  updatePropertyDocumentStatuses,
  deletePropertyDocument,
  // reviews
  getPropertyReviewsSummary,
  getPropertyReviews,
  replyToReview,
  updateReviewPublishStatus,
  deleteReview,
  updateProperty,
  deleteProperty,
  addPropertyAmenities,
  removePropertyAmenities,
} from '../controllers/properties.controller.js';

const router = express.Router();

// Get all properties with filters
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
    query('city').optional().trim(),
    query('status').optional().isIn(['Under Review', 'Accepted', 'Rejected']),
    query('propertyType').optional().trim(),
    query('sortBy').optional().isIn(['createdAt', 'basicPropertyDetails.name', 'status']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  getAllProperties
);

// Export get all properties data
router.get("/export", exportProperties);

// Get property statistics
router.get(
  '/stats',
  getPropertyStats
);


// routes/admin/property.routes.js
router.post(
  "/amenities/:propertyId",
  addPropertyAmenities
);


router.delete(
  "/amenities/:propertyId",
  removePropertyAmenities
);


// Update single Property by id 
router.put("/:id", updateProperty);

router.delete("/:id", deleteProperty);



// Get property by id
router.get(
  '/:id',
  getPropertyById
);




// Get all rooms for a specific property with filters
router.get(
  '/:propertyId/rooms',
  getPropertyRooms
);

// Photo Management Routes

// Get all photos for a property
router.get(
  '/:propertyId/photos',
  getPropertyPhotos
);



// ---- Admin Media Routes ----
// Summary cards (total, approved, pending)
router.get('/:propertyId/media/summary', getPropertyMediaSummary);

// Photos list/add/delete and status updates
router.get('/:propertyId/media/photos', getPropertyPhotos);
router.post('/:propertyId/media/photos', addPropertyMediaPhotos);
router.patch('/:propertyId/media/photos/status', updatePropertyPhotoStatuses);
router.delete('/:propertyId/media/photos/:photoId', deletePropertyMediaPhoto);

// Videos list/add/delete
router.get('/:propertyId/media/videos', getPropertyVideos);
router.post('/:propertyId/media/videos', addPropertyVideos);
router.delete('/:propertyId/media/videos/:videoId', deletePropertyVideo);

// ---- Admin Documents Routes ----
// Summary cards for documents
router.get('/:propertyId/documents/summary', getPropertyDocumentsSummary);

// List and create documents
router.get('/:propertyId/documents', getPropertyDocuments);
router.post('/:propertyId/documents', addPropertyDocuments);

// Update single document and delete
router.put('/:propertyId/documents/:documentId', updatePropertyDocument);
router.delete('/:propertyId/documents/:documentId', deletePropertyDocument);

// Bulk status update
router.patch('/:propertyId/documents/status', updatePropertyDocumentStatuses);

// ---- Admin Reviews Routes ----
// Summary cards + recent reviews
router.get('/:propertyId/reviews/summary', getPropertyReviewsSummary);
// List
router.get('/:propertyId/reviews', getPropertyReviews);
// Reply
router.post('/:propertyId/reviews/:reviewId/reply', replyToReview);
// Publish/unpublish
router.patch('/:propertyId/reviews/:reviewId/publish', updateReviewPublishStatus);
// Delete
router.delete('/:propertyId/reviews/:reviewId', deleteReview);

// ---- Admin Performance Route ----
router.get('/:propertyId/performance', getPropertyPerformance);

export default router;