import express from 'express';
import { query } from 'express-validator';
import { listRoomTypes, seedRoomTypes } from '../controllers/roomTypes.controller.js';

const router = express.Router();

router.post('/seed', seedRoomTypes);

router.get(
  '/',
  [
    query('search').optional().trim(),
    query('onlyActive').optional().isBoolean().toBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  listRoomTypes
);

export default router;
