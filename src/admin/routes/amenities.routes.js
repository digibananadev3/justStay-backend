import express from 'express';
import { query } from 'express-validator';
import { listAmenities, seedRoomAmenities } from '../controllers/amenities.controller.js';

const router = express.Router();

// Seed default room amenities
router.post('/seed/room', seedRoomAmenities);

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
