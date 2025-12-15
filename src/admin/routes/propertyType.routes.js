import express from 'express';
import {
  getPropertyTypes,
  getPropertyTypeById,
  addPropertyType,
  updatePropertyType,
  deletePropertyType
} from '../controllers/propertyType.controller.js';

const router = express.Router();

// Get all property types
router.get('/', getPropertyTypes);

// Get property type by ID
router.get(
  '/:id',
  getPropertyTypeById
);

// Add a new property type
router.post(
  '/',
  addPropertyType
);

// Update a property type
router.put(
  '/:id',
  updatePropertyType
);

// Delete a property type
router.delete('/:id',
  deletePropertyType
);

export default router;
