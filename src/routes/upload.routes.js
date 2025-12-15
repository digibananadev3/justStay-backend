import express from "express";
import {upload} from "../middlewares/upload.middleware.js";
import { uploadFiles } from "../controllers/upload.controller.js";

const router = express.Router();

// Multiple upload route
router.post("/", upload.array("files", 10), uploadFiles);

export default router;
