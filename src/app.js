import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
// import "express-async-errors"; // handles async errors

// Import routes
import authRoutes from "./routes/auth.routes.js";

import errorMiddleware from "./middlewares/error.middleware.js";
import propertyRoutes from "./routes/property.routes.js";
import propertyRoomRoutes from "./routes/propertyRoom.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import roomBooking from "./routes/roomBooking.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import supportTicketRoutes from "./routes/supportTicket.routes.js";
import supportChatRoutes from "./routes/supportChat.routes.js";
import supportKBRoutes from "./routes/supportKB.routes.js";
import cancellationRoutes from "./routes/cancellation.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import ratesRoutes from "./routes/rates.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import revenueRoutes from "./routes/revenue.routes.js";
import settlementsRoutes from "./routes/settlements.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import promotionsRoutes from "./routes/promotions.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import adminRoutes from "./admin/routes/index.routes.js";
import amenitiesRoutes from "./admin/routes/amenities.routes.js";




const app = express();

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// Simple test route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Hotel Stay API is running successfully",
  });
});

// Auth routes
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/rooms", propertyRoomRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/room-bookings", roomBooking);
app.use("/api/reviews", reviewRoutes);
app.use("/api/support", supportTicketRoutes);
app.use("/api/chat-support", supportChatRoutes);
//for knowledge base only used for  admin line master table
app.use("/api/support", supportKBRoutes); 
app.use("/api/cancellations", cancellationRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/rates", ratesRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/settlements", settlementsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/marketing", promotionsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);
// app.use("/api/amenities", amenitiesRoutes);

// Global Error Handler
app.use(errorMiddleware);

export default app;