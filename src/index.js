import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/index.js";

const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
