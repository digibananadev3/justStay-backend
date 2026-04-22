import { createNotification } from "../controllers/notification.controller.js";
import sendSMS from "./smsService.js";
import User from "../models/user.model.js";

const notifyUser = async ({
  userId,
  title,
  message,
  type,
  category,
  link,
  meta,
  sendSms = false
}) => {
  // 1️⃣ Create in-app notification
  const notification = await createNotification({
    userId,
    title,
    message,
    type,
    category,
    link,
    meta
  });

  // 2️⃣ Send SMS (optional)
  if (sendSms) {
    const user = await User.findById(userId).select("mobile");
    if (user?.mobile) {
      try {
        await sendSMS(user.mobile, message);
      } catch (err) {
        console.error("SMS failed for user:", userId, err.message);
      }
    }
  }

  return notification;
};

export default notifyUser;
