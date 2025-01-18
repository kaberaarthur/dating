const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require('fs');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${sanitizedName}`);
  },
});

// Configure multer with validation and limits
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
      return;
    }
    cb(null, true);
  }
});

// Middleware for request validation
const validateUploadRequest = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
  }
  next();
};

// Route for multiple file upload
router.post("/upload", 
  validateUploadRequest,
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "additionalImages", maxCount: 3 },
  ]), 
  (req, res) => {
    try {
      if (!req.files) {
        return res.status(400).json({ error: "No files uploaded." });
      }

      const profilePicture = req.files["profilePicture"] || [];
      const additionalImages = req.files["additionalImages"] || [];

      if (profilePicture.length > 1) {
        return res.status(400).json({ error: "Only one profile picture is allowed." });
      }

      if (additionalImages.length > 3) {
        return res.status(400).json({ error: "You can upload up to 3 additional images." });
      }

      res.status(200).json({
        message: "Files uploaded successfully!",
        profilePicture: profilePicture[0] ? `/uploads/${path.basename(profilePicture[0].path)}` : null,
        additionalImages: additionalImages.map(file => `/uploads/${path.basename(file.path)}`),
      });
    } catch (error) {
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ 
          error: "File upload error", 
          details: error.message 
        });
      }
      res.status(500).json({ 
        error: "Server error during upload", 
        details: error.message 
      });
    }
});

// Route for single file upload
router.post("/upload-single", 
  validateUploadRequest,
  upload.single("photo"), 
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      res.status(200).json({
        message: "File uploaded successfully!",
        filePath: `/uploads/${path.basename(req.file.path)}`,
      });
    } catch (error) {
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ 
          error: "File upload error", 
          details: error.message 
        });
      }
      res.status(500).json({ 
        error: "Server error during upload", 
        details: error.message 
      });
    }
});

// Health check route
router.get("/test", (req, res) => {
  try {  
    res.status(200).json({
      message: "Upload service is running",
      status: "healthy"
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Health check failed", 
      details: error.message 
    });
  }
});

module.exports = router;