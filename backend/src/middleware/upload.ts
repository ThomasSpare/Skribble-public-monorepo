// backend/src/middleware/upload.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const logWithTimestamp = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// Upload directory setup
const uploadDir = path.resolve(process.cwd(), 'uploads', 'audio');

// Ensure upload directory exists
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
    logWithTimestamp('✅ Created upload directory:', uploadDir);
  }
  
  // Test write permissions
  const testFile = path.join(uploadDir, `test-${Date.now()}.tmp`);
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  logWithTimestamp('✅ Directory permissions verified');
} catch (error) {
  console.error('❌ Upload directory setup failed:', error);
  throw error;
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    logWithTimestamp('💾 Setting destination for:', file.originalname);
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        logWithTimestamp('✅ Created upload directory in multer');
      } catch (error) {
        logWithTimestamp('❌ Failed to create directory in multer:', error);
        return cb(error as Error, '');
      }
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    logWithTimestamp('📝 Generating filename for:', file.originalname);
    
    // Generate unique filename with original extension
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    
    logWithTimestamp('✅ Generated filename:', uniqueName);
    cb(null, uniqueName);
  }
});

// File filter for audio files
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  logWithTimestamp('🔍 File filter checking:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });

  const allowedMimes = [
    'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav',
    'audio/aiff', 'audio/x-aiff', 'audio/flac', 'audio/x-flac',
    'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/webm',
    'application/octet-stream' // Sometimes files come as this
  ];

  // Also check file extension as backup
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg'];

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    logWithTimestamp('✅ File type accepted:', file.mimetype);
    cb(null, true);
  } else {
    logWithTimestamp('❌ File type rejected:', file.mimetype);
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedExts.join(', ')}`), false);
  }
};

// Main upload configuration
export const uploadAudio = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    fieldSize: 10 * 1024 * 1024, // 10MB for text fields
    fields: 10,
    files: 1,
    parts: 20
  },
  fileFilter: fileFilter
});

// Alternative configuration for version uploads (could have different limits)
export const uploadAudioVersion = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB for versions (higher limit)
    fieldSize: 10 * 1024 * 1024,
    fields: 10,
    files: 1,
    parts: 20
  },
  fileFilter: fileFilter
});

// Configuration for multiple files (if needed later)
export const uploadMultipleAudio = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024,
    fields: 10,
    files: 5, // Allow up to 5 files
    parts: 50
  },
  fileFilter: fileFilter
});

// Helper function to clean up uploaded files on error
export const cleanupFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logWithTimestamp('🧹 Cleaned up file:', filePath);
    }
  } catch (error) {
    logWithTimestamp('⚠️ Failed to cleanup file:', error);
  }
};

// Helper function to validate uploaded file
export const validateUploadedFile = (file: Express.Multer.File): boolean => {
  try {
    // Check if file exists
    if (!fs.existsSync(file.path)) {
      logWithTimestamp('❌ File does not exist:', file.path);
      return false;
    }

    // Check file size
    const stats = fs.statSync(file.path);
    if (stats.size !== file.size) {
      logWithTimestamp('❌ File size mismatch:', {
        expected: file.size,
        actual: stats.size
      });
      return false;
    }

    // Check if file is readable
    fs.accessSync(file.path, fs.constants.R_OK);
    
    logWithTimestamp('✅ File validation passed:', file.path);
    return true;
  } catch (error) {
    logWithTimestamp('❌ File validation failed:', error);
    return false;
  }
};

export default uploadAudio;