// middleware/auth.middleware.js

import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    console.log("Token", token);
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("decoded", decoded);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};