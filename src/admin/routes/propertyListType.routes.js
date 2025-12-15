import express from 'express';
import {
  getPropertyListTypes,
  getPropertyListTypeById,
  createPropertyListType,
  updatePropertyListType,
  deletePropertyListType
} from '../controllers/propertyListType.controller.js';

const router = express.Router();

router.get('/', getPropertyListTypes);
router.get('/:id', getPropertyListTypeById);
router.post('/', createPropertyListType);
router.put('/:id', updatePropertyListType);
router.delete('/:id', deletePropertyListType);

export default router;
