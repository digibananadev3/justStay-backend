import express from "express";
import { 
  getGuestsStats, 
  listGuests, 
  getGuestDetail, 
  getGuestBookingSummary, 
  getGuestRecentBookings, 
  getGuestReferralsSummary, 
  getGuestReferralsList, 
  getGuestActivity, 
  getGuestSearches, 
  getGuestSearchPreferences,
  getGuestFavorites,
  getGuestFavoritesSummary,
  getGuestReviews,
  getGuestReviewsSummary
} from "../controllers/guests.controller.js";
import { getGuestOffers, getGuestOffersSummary } from "../controllers/offers.controller.js";
import { getGuestAppUsageSummary, getGuestAppUsageLogs } from "../controllers/appUsage.controller.js";

const router = express.Router();

router.get("/stats", getGuestsStats);
router.get("/", listGuests);
router.get("/:id", getGuestDetail);
router.get("/:id/bookings/summary", getGuestBookingSummary);
router.get("/:id/bookings", getGuestRecentBookings);
router.get("/:id/referrals/summary", getGuestReferralsSummary);
router.get("/:id/referrals", getGuestReferralsList);
router.get("/:id/activity", getGuestActivity);
router.get("/:id/searches", getGuestSearches);
router.get("/:id/searches/preferences", getGuestSearchPreferences);

// Favorites routes
router.get("/:id/favorites/summary", getGuestFavoritesSummary);
router.get("/:id/favorites", getGuestFavorites);

// Reviews routes
router.get("/:id/reviews/summary", getGuestReviewsSummary);
router.get("/:id/reviews", getGuestReviews);

// Offers routes
router.get("/:id/offers/summary", getGuestOffersSummary);
router.get("/:id/offers", getGuestOffers);

// App Usage routes
router.get("/:id/app-usage/summary", getGuestAppUsageSummary);
router.get("/:id/app-usage/logs", getGuestAppUsageLogs);

export default router;
