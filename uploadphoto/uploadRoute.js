const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require('../dbPromise');
const authenticateToken = require('../customMiddleware'); 

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


// Add image names to db
router.post('/upload-image', authenticateToken, async (req, res) => {
  const { image_url, is_profile_picture } = req.body;
  const user_id = req.user.id;

  if (!image_url) {
      return res.status(400).json({ error: "Image URL is required" });
  }

  try {
      if (is_profile_picture === 1) {
          // Set existing profile pictures to 0 before setting new one
          await db.execute(
              "UPDATE user_images SET is_profile_picture = 0 WHERE user_id = ?",
              [user_id]
          );
      }

      // Insert or update image
      await db.execute(
          `INSERT INTO user_images (user_id, image_url, is_profile_picture)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), is_profile_picture = VALUES(is_profile_picture)`,
          [user_id, image_url, is_profile_picture]
      );

      res.status(200).json({ message: "Image uploaded successfully" });

  } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Server error" });
  }
});


// Export the router
module.exports = router;