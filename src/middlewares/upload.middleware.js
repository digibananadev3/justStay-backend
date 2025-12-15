import multer from "multer";
import path from "path";
import fs from "fs";

// Define destination based on type (photo/document)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || "photos"; // default photos
    const uploadPath =
      type === "document" ? "uploads/documents" : "uploads/photos";

    // Create folder if not exists
    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Multer filter (optional — restrict file types)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    cb(new Error("Invalid file type! Only images and PDFs allowed."), false);
  } else {
    cb(null, true);
  }
};

export const upload = multer({ storage, fileFilter });
