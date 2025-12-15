import express from "express";
import {
  createNotificationApi,
  listNotifications,
  getNotificationById,
  markRead,
  markAllRead,
  archiveNotification,
  deleteNotification,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.post("/", createNotificationApi);
router.get("/", listNotifications);
router.get("/:id", getNotificationById);
router.post("/:id/read", markRead);
router.post("/read-all", markAllRead);
router.post("/:id/archive", archiveNotification);
router.delete("/:id", deleteNotification);

export default router;
