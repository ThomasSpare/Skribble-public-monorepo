// backend/src/middleware/upload-s3.ts
import multer from 'multer';
import { s3UploadService } from '../services/s3-upload';

const logWithTimestamp = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();

// File filter for audio files  
const audioFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  logWithTimestamp('🔍 Audio file filter checking:', {
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
  const ext = file.originalname.toLowerCase();
  const allowedExts = ['.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg'];
  const hasValidExt = allowedExts.some(validExt => ext.endsWith(validExt));

  if (allowedMimes.includes(file.mimetype) || hasValidExt) {
    logWithTimestamp('✅ Audio file type accepted:', file.mimetype);
    cb(null, true);
  } else {
    logWithTimestamp('❌ Audio file type rejected:', file.mimetype);
    cb(new Error(`Invalid audio file type: ${file.mimetype}. Allowed: ${allowedExts.join(', ')}`), false);
  }
};

// File filter for image files
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  logWithTimestamp('🔍 Image file filter checking:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });

  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 
    'image/gif', 'image/bmp', 'image/tiff'
  ];

  // Also check file extension as backup
  const ext = file.originalname.toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'];
  const hasValidExt = allowedExts.some(validExt => ext.endsWith(validExt));

  if (allowedMimes.includes(file.mimetype) || hasValidExt) {
    logWithTimestamp('✅ Image file type accepted:', file.mimetype);
    cb(null, true);
  } else {
    logWithTimestamp('❌ Image file type rejected:', file.mimetype);
    cb(new Error(`Invalid image file type: ${file.mimetype}. Allowed: ${allowedExts.join(', ')}`), false);
  }
};

// S3 upload configuration for audio files
export const uploadAudioS3 = multer({
  storage: storage, // Use memory storage
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    fieldSize: 10 * 1024 * 1024, // 10MB for text fields
    fields: 10,
    files: 1,
    parts: 20
  },
  fileFilter: audioFileFilter
});

// S3 upload configuration for images
export const uploadImageS3 = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
    fieldSize: 1 * 1024 * 1024, // 1MB for text fields
    fields: 10,
    files: 1,
    parts: 20
  },
  fileFilter: imageFileFilter
});

// Alternative configuration for version uploads
export const uploadAudioVersionS3 = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB for versions
    fieldSize: 10 * 1024 * 1024,
    fields: 10,
    files: 1,
    parts: 20
  },
  fileFilter: audioFileFilter
});

// Helper function to upload audio file buffer to S3
export const uploadAudioToS3 = async (
  file: Express.Multer.File, 
  projectId: string,  // Required for audio uploads
  includeOriginalName: boolean = false
) => {
  try {
    logWithTimestamp('🎵 Uploading audio to S3:', {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      projectId,
      includeOriginalName
    });

    const result = await s3UploadService.uploadBuffer(
      file.buffer,
      file.originalname,
      file.mimetype,
      { 
        projectId,
        includeOriginalName 
      }
    );

    logWithTimestamp('✅ Audio S3 upload successful:', result);
    return result;
  } catch (error) {
    logWithTimestamp('❌ Audio S3 upload failed:', error);
    throw error;
  }
};

// Helper function to upload image file buffer to S3  
export const uploadImageToS3 = async (
  file: Express.Multer.File, 
  userId: string,  // Required for image uploads
  includeOriginalName: boolean = false
) => {
  try {
    logWithTimestamp('🖼️ Uploading image to S3:', {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      userId,
      includeOriginalName
    });

    const result = await s3UploadService.uploadBuffer(
      file.buffer,
      file.originalname,
      file.mimetype,
      { 
        userId,
        includeOriginalName
      }
    );

    logWithTimestamp('✅ Image S3 upload successful:', result);
    return result;
  } catch (error) {
    logWithTimestamp('❌ Image S3 upload failed:', error);
    throw error;
  }
};

export default uploadAudioS3;