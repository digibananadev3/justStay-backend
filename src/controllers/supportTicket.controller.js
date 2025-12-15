import mongoose from "mongoose";
import SupportTicket from "../models/supportTicket.model.js";
import SupportTicketMessage from "../models/supportTicketMessage.model.js";
import Property from "../models/property.model.js";
import RoomBooking from "../models/roomBooking.model.js";

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

const genTicketNo = async () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const start = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  const end = new Date(`${y}-${m}-${d}T23:59:59.999Z`);
  const count = await SupportTicket.countDocuments({ createdAt: { $gte: start, $lte: end } });
  const seq = pad(count + 1).padStart(4, "0");
  return `SUP-${y}${m}${d}-${seq}`;
};

export const createTicket = async (req, res) => {
  try {
    const { userId, category, priority, subject, description, bookingId, attachments } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    if (!category) return res.status(400).json({ success: false, message: "category is required" });
    if (!subject) return res.status(400).json({ success: false, message: "subject is required" });
    
    const ticketNo = await genTicketNo();
    const booingDetails = await RoomBooking.findById(bookingId)
    const priorityInfo = await Property.findById(booingDetails?.propertyId)
    const assignee = priorityInfo?.userId

    const ticket = await SupportTicket.create({
      ticketNo,
      createdBy: new mongoose.Types.ObjectId(userId),
      assignee: assignee,
      category,
      priority: priority || "Low",
      subject,
      description,
      bookingId: bookingId && mongoose.Types.ObjectId.isValid(bookingId) ? new mongoose.Types.ObjectId(bookingId) : undefined,
      attachments: Array.isArray(attachments) ? attachments : [],
      timeline: [{ at: new Date(), action: "Created", by: new mongoose.Types.ObjectId(userId) }],
    });

    res.status(201).json({ success: true, message: "Ticket created", data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listTickets = async (req, res) => {
  try {
    const { status, priority, category, createdBy, assignee, bookingId, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) filter.createdBy = new mongoose.Types.ObjectId(createdBy);
    if (assignee && mongoose.Types.ObjectId.isValid(assignee)) filter.assignee = new mongoose.Types.ObjectId(assignee);
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) filter.bookingId = new mongoose.Types.ObjectId(bookingId);
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate("createdBy", "firstName lastName phone role")
        .populate("assignee", "firstName lastName role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SupportTicket.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findById(id)
      .populate("createdBy", "firstName lastName phone role")
      .populate("assignee", "firstName lastName role");
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (updates.assignee && mongoose.Types.ObjectId.isValid(updates.assignee)) {
      updates.assignee = new mongoose.Types.ObjectId(updates.assignee);
    }
    const ticket = await SupportTicket.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    res.status(200).json({ success: true, message: "Ticket updated", data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const addTicketMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, message, attachments } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    if (!message) return res.status(400).json({ success: false, message: "message is required" });

    const ticket = await SupportTicket.findById(id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    const msg = await SupportTicketMessage.create({
      ticketId: ticket._id,
      sender: new mongoose.Types.ObjectId(userId),
      message,
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    res.status(201).json({ success: true, message: "Message added", data: msg });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listTicketMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      SupportTicketMessage.find({ ticketId: id })
        .populate("sender", "firstName lastName role")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(Number(limit)),
      SupportTicketMessage.countDocuments({ ticketId: id }),
    ]);

    res.status(200).json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findById(id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    ticket.status = "Closed";
    ticket.timeline.push({ at: new Date(), action: "Closed" });
    await ticket.save();
    res.status(200).json({ success: true, message: "Ticket closed", data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
