import express from 'express';
import { query } from 'express-validator';
import {
  getBookingsOverview,
  listBookings,
  listHourlyBookings,
  listRefundBookings,
  listDisputeBookings,
  listOtaBookings,
  getBookingById,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  setPaymentStatus,
  setBookingSource,
  updateRefund,
  updateDispute,
  otaSync,
  updateAdminNotes,
  updateSpecialRequests,
  updatePaymentInfo,
  updateStayDetails,
  updatePriceSummary,
  resendBookingConfirmation,
  generateVoucher,
  contactGuest,
} from '../controllers/bookingManager.controller.js';

const router = express.Router();

// Overview cards
router.get('/overview', getBookingsOverview);

// List bookings with filters
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
    query('status').optional().trim(),
    query('source').optional().trim(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('isHourly').optional().isBoolean().toBoolean(),
  ],
  listBookings
);

// Tab-specific lists
router.get(
  '/hourly',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
    query('status').optional().trim(),
    query('source').optional().trim(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  listHourlyBookings
);

router.get(
  '/refunds',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
    query('status').optional().trim(),
    query('source').optional().trim(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  listRefundBookings
);

router.get(
  '/disputes',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
    query('status').optional().trim(),
    query('source').optional().trim(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  listDisputeBookings
);

router.get(
  '/ota',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
    query('status').optional().trim(),
    query('source').optional().trim(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  listOtaBookings
);

// Get single booking
router.get('/:id', getBookingById);

// Actions
router.post('/:id/check-in', checkInBooking);
router.post('/:id/check-out', checkOutBooking);
router.post('/:id/cancel', cancelBooking);
router.patch('/:id/payment', setPaymentStatus);
router.patch('/:id/source', setBookingSource);
router.patch('/:id/refund', updateRefund);
router.patch('/:id/dispute', updateDispute);
router.post('/:id/ota-sync', otaSync);

// Details panel updates
router.patch('/:id/notes', updateAdminNotes);
router.patch('/:id/requests', updateSpecialRequests);
router.patch('/:id/payment-info', updatePaymentInfo);
router.patch('/:id/stay-details', updateStayDetails);
router.patch('/:id/price-summary', updatePriceSummary);
router.post('/:id/resend-confirmation', resendBookingConfirmation);
router.post('/:id/voucher', generateVoucher);
router.post('/:id/contact', contactGuest);

// Bookging Management


export default router;
