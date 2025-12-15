import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // const MONGO_URI = process.env.MONGO_URI;
    // const MONGO_URI = "mongodb+srv://vikas_hotel_stay:Vikas2111@hotelstay.ywzrx5a.mongodb.net/?appName=Hotelstay";
    const MONGO_URI = "mongodb+srv://digibananadev4_db_user:6rMQib3VDwEzYvxc@cluster0.gbebrzh.mongodb.net/test";
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

export default connectDB;
