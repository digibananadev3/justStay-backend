import express from "express";
import {
  createTicket,
  listTickets,
  getTicketById,
  updateTicket,
  addTicketMessage,
  listTicketMessages,
  closeTicket,
} from "../controllers/supportTicket.controller.js";

const router = express.Router();

router.post("/", createTicket);
router.get("/", listTickets);
router.get("/:id", getTicketById);
router.patch("/:id", updateTicket);
router.post("/:id/messages", addTicketMessage);
router.get("/:id/messages", listTicketMessages);
router.post("/:id/close", closeTicket);

export default router;
