const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require('../dbPromise');

// Create a router instance
const router = express.Router();

// Set up storage directory
const uploadDir = path.join(__dirname, "../uploads"); // Adjust path based on your project structure
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // Create uploads directory if it doesn't exist, recursively
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Store files in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    // Use the original filename from the client
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Serve static files from the uploads directory
router.use("/uploads", express.static(uploadDir));
// http://localhost:5000/api/new-image-upload/uploads/a.jpg

// Route to handle file uploads
router.post("/", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "secondaryImages", maxCount: 3 }, // Adjust maxCount based on your needs
]), (req, res) => {
  try {
    const mainImage = req.files["mainImage"] ? req.files["mainImage"][0] : null;
    const secondaryImages = req.files["secondaryImages"] || [];

    // Log the file locations
    if (mainImage) {
      console.log(`Main Image Location: ${path.join(uploadDir, mainImage.filename)}`);
      // Insert this data into db
    }
    secondaryImages.forEach((file, index) => {
      console.log(`Secondary Image ${index + 1} Location: ${path.join(uploadDir, file.filename)}`);
      // Insert this data into db
    });

    // Send success response to client
    res.status(200).json({
      message: "Files uploaded successfully",
      files: {
        mainImage: mainImage ? mainImage.filename : null,
        secondaryImages: secondaryImages.map((file) => file.filename),
      },
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).json({ message: "Error uploading files" });
  }
});

// Export the router
module.exports = router;