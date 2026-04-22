import express from "express";
import {
  createNotificationApi,
  listNotifications,
  getNotificationById,
  markRead,
  markAllRead,
  archiveNotification,
  deleteNotification,
  testNotificationApi,
  testNotificationMessageApi,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/test", testNotificationApi);
router.post("/test/sendSMS", testNotificationMessageApi);
router.post("/", createNotificationApi);
router.get("/", listNotifications);
router.get("/:id", getNotificationById);
router.post("/:id/read", markRead);
router.post("/read-all", markAllRead);
router.post("/:id/archive", archiveNotification);
router.delete("/:id", deleteNotification);

export default router;
