import express from "express";
import { getAdminOverview } from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/overview", getAdminOverview);

export default router;
