import express from 'express';
import { query } from 'express-validator';
import {
  getContentOverview,
  listContent,
  getContentById,
  createContent,
  updateContent,
  publishContent,
  deleteContent,
} from '../controllers/content.controller.js';

const router = express.Router();

// Overview cards per tab
router.get('/overview', getContentOverview);

// List with filters
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('type').optional().trim(), // campaign|banner|partner|announcement
    query('status').optional().trim(), // draft|published|archived
    query('placement').optional().trim(),
    query('search').optional().trim(),
  ],
  listContent
);

// CRUD
router.get('/:id', getContentById);
router.post('/', createContent);
router.put('/:id', updateContent);
router.patch('/:id/publish', publishContent);
router.delete('/:id', deleteContent);

export default router;
