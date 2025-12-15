import express from "express";
import {
  createChatSession,
  listChatSessions,
  sendChatMessage,
  listChatMessages,
  closeChatSession,
} from "../controllers/supportChat.controller.js";

const router = express.Router();

router.post("/sessions", createChatSession);
router.get("/sessions", listChatSessions);
router.post("/sessions/:id/messages", sendChatMessage);
router.get("/sessions/:id/messages", listChatMessages);
router.post("/sessions/:id/close", closeChatSession);

export default router;
