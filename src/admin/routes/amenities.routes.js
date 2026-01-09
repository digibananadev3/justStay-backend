import express from 'express';
import { body, param, query } from 'express-validator';
import { listAmenities, seedRoomAmenities, createAmenity, updateAmenity, deleteAmenity  } from '../controllers/amenities.controller.js';

const router = express.Router();

// Seed default room amenities
router.post('/seed/room', seedRoomAmenities);


// Create amenity
router.post(
  "/create",
  [
    body("name").trim().notEmpty().withMessage("Amenity name is required"),
    body("category").optional().trim(),
    body("icon").optional().trim(),
    body("isActive").optional().isBoolean(),
  ],
  createAmenity
);


// Update amenity
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid amenity ID"),
    body("name").optional().trim(),
    body("category").optional().trim(),
    body("icon").optional().trim(),
    body("isActive").optional().isBoolean(),
  ],
  updateAmenity
);


// Delete amenity (soft delete)
router.delete(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid amenity ID"),
  ],
  deleteAmenity
);


// List amenities
router.get(
  '',
  [
    query('category').optional().trim(),
    query('search').optional().trim(),
    query('onlyActive').optional().isBoolean().toBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  listAmenities
);




export default router;
