/**
 * File Upload Middleware
 * Handles file uploads with validation and security
 * @version 1.0.0
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');  // ← UPDATED PATH
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Configure multer storage
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectories based on file type
    let subDir = 'others';
    
    if (file.mimetype.startsWith('image/')) {
      subDir = 'images';
    } else if (file.mimetype.startsWith('video/')) {
      subDir = 'videos';
    } else if (file.mimetype === 'application/pdf') {
      subDir = 'documents';
    } else if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
      subDir = 'spreadsheets';
    }

    const destPath = path.join(uploadDir, subDir);
    
    // Create subdirectory if it doesn't exist
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }

    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

/**
 * File filter to validate file types
 */
const fileFilter = (req, file, cb) => {
  // Allowed MIME types
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 
    'image/jpeg,image/png,image/gif,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ).split(',');

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn('Invalid file type upload attempt:', {
      mimetype: file.mimetype,
      filename: file.originalname,
      user: req.user?.id
    });

    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

/**
 * Base multer configuration
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 10 // Max 10 files at once
  }
});

/**
 * Memory storage for file processing (e.g., Excel import)
 */
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
    files: 1
  }
});

/**
 * Middleware for single file upload
 * @param {string} fieldName - Form field name
 */
const uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        logger.error('Multer error:', err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File size exceeds the limit of ${(parseInt(process.env.MAX_FILE_SIZE) / 1024 / 1024).toFixed(2)}MB`
          });
        }
        
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`
        });
      } else if (err) {
        logger.error('Upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      
      if (req.file) {
        logger.info('File uploaded successfully:', {
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          user: req.user?.id
        });
      }
      
      next();
    });
  };
};

/**
 * Middleware for multiple file upload
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Maximum number of files
 */
const uploadMultiple = (fieldName = 'files', maxCount = 10) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        logger.error('Multer error:', err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File size exceeds the limit of ${(parseInt(process.env.MAX_FILE_SIZE) / 1024 / 1024).toFixed(2)}MB`
          });
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `Cannot upload more than ${maxCount} files`
          });
        }
        
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`
        });
      } else if (err) {
        logger.error('Upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      
      if (req.files && req.files.length > 0) {
        logger.info('Multiple files uploaded successfully:', {
          count: req.files.length,
          user: req.user?.id
        });
      }
      
      next();
    });
  };
};

/**
 * Middleware for Excel/CSV import (memory storage)
 * @param {string} fieldName - Form field name
 */
const uploadExcel = (fieldName = 'file') => {
  return (req, res, next) => {
    const excelUpload = memoryUpload.single(fieldName);
    
    excelUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        logger.error('Excel upload error:', err);
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`
        });
      } else if (err) {
        logger.error('Excel upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      
      if (req.file) {
        logger.info('Excel file uploaded for processing:', {
          filename: req.file.originalname,
          size: req.file.size,
          user: req.user?.id
        });
      }
      
      next();
    });
  };
};

/**
 * Clean up uploaded file (use in error handlers)
 * @param {string} filePath - Path to file
 */
const cleanupFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        logger.error('File cleanup error:', err);
      } else {
        logger.info('File cleaned up:', filePath);
      }
    });
  }
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadExcel,
  cleanupFile
};
