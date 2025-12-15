import express from "express";
import {
  getRatesCalendar,
  upsertRateDay,
  bulkRates,
  listRoomRates,
  deleteRateOverride,
} from "../controllers/rates.controller.js";

const router = express.Router();

// Calendar view
router.get("/calendar", getRatesCalendar);

// Single day/plan upsert
router.put("/day/:roomId/:date/:plan", upsertRateDay);

// Bulk range
router.patch("/bulk", bulkRates);
/**
 * {
  "roomIds": ["6720r1..."],
  "plans": ["RO","CP"],
  "dateFrom": "2025-09-27",
  "dateTo": "2025-10-05",
  "applyOn": ["Fri","Sat","Sun"],
  "price": 1200,
  "extraAdultPrice": 400,
  "extraChildPrice": 200,
  "overrideLevel": "override"
}
 */

// Manage overrides
router.get("/room/:roomId", listRoomRates);
router.delete("/day/:roomId/:date/:plan", deleteRateOverride);

export default router;
