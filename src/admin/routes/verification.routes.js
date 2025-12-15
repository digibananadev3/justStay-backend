import express from 'express';
import {
  getVerificationOverview,
  listGuestVerifications,
  updateGuestKycStatus,
  updateGuestDocuments,
  flagGuest,
  getGuestVerificationDetail,
  updateGuestVerificationNote,
  setGuestBypassAutoCheck,
  resendGuestVerificationRequest,
  updateGuestSingleDocument,
  listHotelVerifications,
  updateHotelDocuments,
  getHotelVerificationDetail,
  updateHotelVerificationNote,
  setHotelBypassAutoCheck,
  resendHotelVerificationRequest,
  updateHotelSingleDocument,
  getHotelListingSummary,
  approveHotelListing,
  rejectHotelListing,
  updateHotelBadges,
  addHotelFlag,
  removeHotelFlag,
  requestHotelMoreInfo,
} from '../controllers/verification.controller.js';

const router = express.Router();

// Overview
router.get('/overview', getVerificationOverview);

// Guests (users)
router.get('/guests', listGuestVerifications);
router.patch('/guests/:userId/status', updateGuestKycStatus);
router.patch('/guests/:userId/documents', updateGuestDocuments);
router.patch('/guests/:userId/flags', flagGuest);
router.get('/guests/:userId', getGuestVerificationDetail);
router.patch('/guests/:userId/note', updateGuestVerificationNote);
router.patch('/guests/:userId/bypass', setGuestBypassAutoCheck);
router.post('/guests/:userId/resend', resendGuestVerificationRequest);
router.patch('/guests/:userId/documents/:documentId', updateGuestSingleDocument);

// Hotels (properties)
router.get('/hotels', listHotelVerifications);
router.patch('/hotels/:propertyId/documents', updateHotelDocuments);
router.get('/hotels/:propertyId', getHotelVerificationDetail);
router.patch('/hotels/:propertyId/note', updateHotelVerificationNote);
router.patch('/hotels/:propertyId/bypass', setHotelBypassAutoCheck);
router.post('/hotels/:propertyId/resend', resendHotelVerificationRequest);
router.patch('/hotels/:propertyId/documents/:documentId', updateHotelSingleDocument);
// Listing summary and actions
router.get('/hotels/:propertyId/listing/summary', getHotelListingSummary);
router.post('/hotels/:propertyId/listing/approve', approveHotelListing);
router.post('/hotels/:propertyId/listing/reject', rejectHotelListing);
router.patch('/hotels/:propertyId/badges', updateHotelBadges);
router.post('/hotels/:propertyId/flags', addHotelFlag);
router.delete('/hotels/:propertyId/flags', removeHotelFlag);
router.post('/hotels/:propertyId/request-more-info', requestHotelMoreInfo);

export default router;
