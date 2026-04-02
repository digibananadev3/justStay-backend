import http from "http";
import { Server } from "socket.io";
import app from "./app.js";

// Create HTTP server from Express
export const httpServer = http.createServer(app);

// Attach Socket.IO to same server
// export const io = new Server(httpServer, {
//   cors: {
//     origin: ["http://localhost:3000", "http://localhost:3001"],
//     credentials: true
//   }
// });

export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {

  socket.on("joinChat", (sessionId) => {
      if (!sessionId) return;
    socket.join(sessionId);
     console.log(
    "Rooms for socket:",
    Array.from(socket.rooms)
  );
  });

  

  socket.on("disconnect", () => {
       console.log("❌ User disconnected:", socket.id);
  });
});
