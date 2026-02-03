import mongoose from "mongoose";
import SupportChatSession from "../models/supportChatSession.model.js";
import SupportChatMessage from "../models/supportChatMessage.model.js";
import { io } from "../server.js";

export const createChatSession = async (req, res) => {
  try {
    const { userId, topic, relatedTicketId } = req.body;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });

    const session = await SupportChatSession.create({
      createdBy: new mongoose.Types.ObjectId(userId),
      participants: [new mongoose.Types.ObjectId(userId)],
      topic,
      relatedTicketId:
        relatedTicketId && mongoose.Types.ObjectId.isValid(relatedTicketId)
          ? new mongoose.Types.ObjectId(relatedTicketId)
          : undefined,
      status: "Open",
    });

    res
      .status(201)
      .json({ success: true, message: "Session created", data: session });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const listChatSessions = async (req, res) => {
  try {
    console.log("req.query", req.query);
    const { userId, status = "Open", page = 1, limit = 20 } = req.query;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
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

    res
      .status(200)
      .json({
        success: true,
        count: items.length,
        total,
        page: Number(page),
        limit: Number(limit),
        data: items,
      });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const sendChatMessage = async (req, res) => {
  try {
    const { id } = req.params; // sessionId
    console.log("Sending message to session:", id);
    console.log("req.body", req.body);
    const { userId, message, attachments } = req.body;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    if (!message)
      return res
        .status(400)
        .json({ success: false, message: "message is required" });

    const session = await SupportChatSession.findById(id);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    // add participant if not present
    const uid = new mongoose.Types.ObjectId(userId);
    if (!session.participants.find((p) => p.toString() === uid.toString())) {
      session.participants.push(uid);
      await session.save();
    }

    // const msg = await SupportChatMessage.create({
    //   sessionId: session._id,
    //   sender: uid,
    //   message,
    //   attachments: Array.isArray(attachments) ? attachments : [],
    // });

    // res.status(201).json({ success: true, message: "Message sent", data: msg });

    const msg = await SupportChatMessage.create({
      sessionId: session._id,
      sender: uid,
      message,
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    // populate sender for UI
    const populated = await msg.populate("sender", "firstName lastName role");

    // 🔥 SEND LIVE EVENT
    io.to(id).emit("receiveMessage", populated);

    res
      .status(201)
      .json({ success: true, message: "Message sent", data: populated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
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

    res
      .status(200)
      .json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const closeChatSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await SupportChatSession.findById(id);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    session.status = "Closed";
    await session.save();
    res
      .status(200)
      .json({ success: true, message: "Session closed", data: session });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};



// For the Support Admin to see all chat sessions
// export const adminListAllChats = async (req, res) => {
//   try {
//     const { status = "Open", page = 1, limit = 20 } = req.query;

//     // const filter = {};
//     // if (status) filter.status = status;

//     // const skip = (page - 1) * limit;

//     // const [items, total] = await Promise.all([
//     //   SupportChatSession.find(filter)
//     //     .populate("createdBy", "firstName lastName")
//     //     // .populate("assignedAdmin", "firstName lastName")
//     //     .sort({ updatedAt: -1 })
//     //     .skip(skip)
//     //     .limit(Number(limit)),
//     //   SupportChatSession.countDocuments(filter)
//     // ]);

//     const data = await SupportChatMessage?.find({})?.populate("sender", "firstName lastName role");
//     //   const data = await SupportChatMessage.aggregate([
//     //   // Join session
//     //   {
//     //     $lookup: {
//     //       from: "supportchatsessions",
//     //       localField: "sessionId",
//     //       foreignField: "_id",
//     //       as: "sessionId"
//     //     }
//     //   },
//     //   { $unwind: "$sessionId" },

//     //   // Only Open sessions (optional)
//     //   { $match: { "sessionId.status": status } },

//     //   // Join sender
//     //   {
//     //     $lookup: {
//     //       from: "users",
//     //       localField: "sender",
//     //       foreignField: "_id",
//     //       as: "sender"
//     //     }
//     //   },
//     //   { $unwind: "$sender" },

//     //   // ❌ REMOVE ADMIN MESSAGES
//     //   {
//     //     $match: { "sender.role": { $ne: "admin" } }
//     //   },
//     // ]);



//     res.json({ success: true, data: data });
//   } catch (e) {
//     res.status(500).json({ success: false, message: e.message });
//   }
// };


export const adminListAllChats = async (req, res) => {
  try {
    const { status = "Open" } = req.query;

    const sessions = await SupportChatSession.aggregate([
      { $match: { status } },

      // Join messages
      {
        $lookup: {
          from: "supportchatmessages",
          localField: "_id",
          foreignField: "sessionId",
          as: "messages"
        }
      },
      {

        // Last message only
        $addFields: {
          lastMessage: {
            $cond: [
              { $gt: [{ $size: "$messages" }, 0] },
              { $arrayElemAt: ["$messages", -1] },
              null
            ]
          }
        },
      },


      // Join user
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy"
        }
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true
        }
      },

      // Sort by last activity
      {
        $addFields: {
          sortDate: { $ifNull: ["$lastMessage.createdAt", "$createdAt"] }
        }
      },
      { $sort: { sortDate: -1 } },

      // Shape for frontend
      {
        $project: {
          _id: 1,
          topic: 1,
          status: 1,
          createdAt: 1,
          // "createdBy.firstName": 1,
          // "createdBy.lastName": 1,
          createdBy: {
            firstName: { $ifNull: ["$createdBy.firstName", "Guest"] },
            lastName: { $ifNull: ["$createdBy.lastName", "User"] },
            role: { $ifNull: ["$createdBy.role", "customer"] }
          },
          lastMessage: {
            message: 1,
            createdAt: 1
          }
        }
      }
    ]);

    res.json({ success: true, data: sessions });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
