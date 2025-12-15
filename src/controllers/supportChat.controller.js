import mongoose from "mongoose";
import SupportChatSession from "../models/supportChatSession.model.js";
import SupportChatMessage from "../models/supportChatMessage.model.js";

export const createChatSession = async (req, res) => {
  try {
    const { userId, topic, relatedTicketId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const session = await SupportChatSession.create({
      createdBy: new mongoose.Types.ObjectId(userId),
      participants: [new mongoose.Types.ObjectId(userId)],
      topic,
      relatedTicketId: relatedTicketId && mongoose.Types.ObjectId.isValid(relatedTicketId)
        ? new mongoose.Types.ObjectId(relatedTicketId)
        : undefined,
      status: "Open",
    });

    res.status(201).json({ success: true, message: "Session created", data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listChatSessions = async (req, res) => {
  try {
    console.log("req.query", req.query)
    const { userId, status = "Open", page = 1, limit = 20 } = req.query;
    
    if(!userId){
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    const filter = {};
    if (status) filter.status = status;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.$or = [
        { createdBy: new mongoose.Types.ObjectId(userId) },
        { participants: new mongoose.Types.ObjectId(userId) },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      SupportChatSession.find(filter)
        .populate("createdBy", "firstName lastName role")
        .populate("participants", "firstName lastName role")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SupportChatSession.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const sendChatMessage = async (req, res) => {
  try {
    const { id } = req.params; // sessionId
    const { userId, message, attachments } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    if (!message) return res.status(400).json({ success: false, message: "message is required" });

    const session = await SupportChatSession.findById(id);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    // add participant if not present
    const uid = new mongoose.Types.ObjectId(userId);
    if (!session.participants.find((p) => p.toString() === uid.toString())) {
      session.participants.push(uid);
      await session.save();
    }

    const msg = await SupportChatMessage.create({
      sessionId: session._id,
      sender: uid,
      message,
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    res.status(201).json({ success: true, message: "Message sent", data: msg });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listChatMessages = async (req, res) => {
  try {
    const { id } = req.params; // sessionId
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      SupportChatMessage.find({ sessionId: id })
        .populate("sender", "firstName lastName role")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(Number(limit)),
      SupportChatMessage.countDocuments({ sessionId: id }),
    ]);

    res.status(200).json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const closeChatSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await SupportChatSession.findById(id);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });
    session.status = "Closed";
    await session.save();
    res.status(200).json({ success: true, message: "Session closed", data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
