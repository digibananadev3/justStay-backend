import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/index.js";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4000;

// Connect to MongoDB
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
