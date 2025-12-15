export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const type = req.body.type || "photo";

    // Generate URLs (you can replace this with S3 or Cloudinary URLs later)
    const urls = req.files.map((file) => ({
      type,
      key: file.fieldname,
      url: `${req.protocol}://${req.get("host")}/${file.path}`,
    }));

    res.status(200).json({
      message: `${req.files.length} ${type}(s) uploaded successfully`,
      urls,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: "File upload failed", error: error.message });
  }
};
