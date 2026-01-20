import express from 'express';
import {
  getPropertyListTypes,
  getPropertyListTypeById,
  createPropertyListType,
  updatePropertyListType,
  deletePropertyListType,
  fetchPropertyListTypesStats
} from '../controllers/propertyListType.controller.js';
import { fetchPropertyTypeStats } from '../controllers/propertyType.controller.js';

const router = express.Router();

router.get('/', getPropertyListTypes);
router.get('/property-type-list-stats', fetchPropertyListTypesStats)
router.get('/:id', getPropertyListTypeById);
router.post('/', createPropertyListType);
router.put('/:id', updatePropertyListType);
router.delete('/:id', deletePropertyListType);

export default router;
