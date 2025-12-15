import express from "express";
import {
  getInventoryCalendar,
  getInventoryDay,
  patchInventoryDay,
  updateDayRatesAndRestrictions,
  deleteInventoryDay,
  bulkInventory,
  toggleOpenClose,
  saveBulkChanges,
} from "../controllers/inventory.controller.js";

const router = express.Router();

// Inventory APIs used by Calendar view and Manage All Rates screens

// GET /calendar
// Purpose: Fetch month view for selected rooms/properties. Returns per-room day objects
// with inventory state and quick rate snapshot so the calendar can render badges like
// "Non Sel." and base prices.
router.get("/calendar", getInventoryCalendar);

// GET /day/:roomId/:date
// Purpose: Read a single day's complete inventory + rate plans + restrictions for a room.
// Why: Drives the Manage All Rates screen when opening a specific date.
router.get("/day/:roomId/:date", getInventoryDay);
// PATCH /day/:roomId/:date
// Purpose: Partially upsert a day's core inventory flags and sellability.
// Body (any subset): { allotment, open, stopSell, notes, sellStatus, nonSellReasons, baseRateSummary, ratePlans, restrictions }
// Why: Quick edits from calendar or day panel without replacing everything.
router.patch("/day/:roomId/:date", patchInventoryDay);
// PATCH /day/:roomId/:date/rates
// Purpose: Update only pricing (ratePlans) and restrictions for that day.
// Why: Dedicated endpoint for the Manage All Rates form to save rates/restrictions together.
router.patch("/day/:roomId/:date/rates", updateDayRatesAndRestrictions);
// DELETE /day/:roomId/:date
// Purpose: Remove an explicit override for a day, reverting UI to defaults (open=true, allotment=0, etc.).
router.delete("/day/:roomId/:date", deleteInventoryDay);

// PATCH /bulk
// Purpose: Apply inventory changes to a date range and multiple rooms (e.g., open/close or allotment).
// Body example:
// {
//   "roomIds": ["6720..."],
//   "dateFrom": "2025-09-27",
//   "dateTo": "2025-09-30",
//   "applyOn": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
//   "allotment": 5,
//   "open": true,
//   "stopSell": false
// }
router.patch("/bulk", bulkInventory);
// POST /toggle
// Purpose: Quickly open/close a set of rooms across a date range (no rate changes).
router.post("/toggle", toggleOpenClose);

// POST /save
// Purpose: Save batched edits from the UI in one request (primarily inventory objects).
// Body example:
// {
//   "inventory": [ { "roomId": "6720...", "date": "2025-09-27", "allotment": 5, "open": true } ],
//   "rates": []
// }
router.post("/save", saveBulkChanges);
/*
{
  "inventory": [
    { "roomId": "6720r1...", "date": "2025-09-27", "allotment": 5, "open": true },
    { "roomId": "6720r1...", "date": "2025-09-28", "allotment": 5, "open": true }
  ],
  "rates": []
}
*/



export default router;
