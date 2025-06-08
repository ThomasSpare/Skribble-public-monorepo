// backend/src/routes/upload.ts - FIXED VERSION with better multer handling
import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../config/database';

const router = express.Router();

interface CustomError extends Error {
  message: string;
}

const logWithTimestamp = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// Windows-specific upload directory setup
const uploadDir = path.resolve(process.cwd(), 'uploads', 'audio');
const imageUploadDir = path.resolve(process.cwd(), 'uploads', 'images');
logWithTimestamp('Upload directory path:', uploadDir);

try {
  if (!fs.existsSync(imageUploadDir)) {
    fs.mkdirSync(imageUploadDir, { recursive: true, mode: 0o755 });
    logWithTimestamp('✅ Created image upload directory:', imageUploadDir);
  }
} catch (error) {
  console.error('❌ Image upload directory setup failed:', error);
}

// Create directory with better error handling
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
  process.exit(1); // Exit if we can't set up uploads
}

// FIXED: More robust multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    logWithTimestamp('💾 Multer destination called for:', file.originalname);
    
    // Choose directory based on file type or endpoint
    const isImage = file.mimetype.startsWith('image/');
    const targetDir = isImage ? imageUploadDir : uploadDir;
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
        logWithTimestamp('✅ Created upload directory in multer:', targetDir);
      } catch (error) {
        logWithTimestamp('❌ Failed to create directory in multer:', error);
        return cb(error as Error, '');
      }
    }
    
    logWithTimestamp('✅ Destination set to:', targetDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    logWithTimestamp('📝 Multer filename called for:', file.originalname);
    
    // Generate unique filename with original extension
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    
    logWithTimestamp('✅ Generated filename:', uniqueName);
    cb(null, uniqueName);
  }
});


const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Keep 100MB for audio, images will be smaller
    fieldSize: 10 * 1024 * 1024,
    fields: 10,
    files: 1,
    parts: 20
  },
  fileFilter: (req, file, cb) => {
    logWithTimestamp('🔍 File filter checking:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname,
      size: file.size || 'unknown'
    });

    const allowedMimes = [
      'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/aiff', 'audio/x-aiff', 'audio/flac', 'audio/x-flac',
      'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/webm',
      'application/octet-stream' // Sometimes files come as this
    ];

      const allowedImageMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
  ];

  const isAudio = allowedMimes.includes(file.mimetype);
  const isImage = allowedImageMimes.includes(file.mimetype);

  if (isAudio || isImage) {
    logWithTimestamp('✅ File type accepted:', file.mimetype);
    // Allow the file
    if (isImage) {
      logWithTimestamp('📸 Image file detected:', file.originalname);
    } else {
      logWithTimestamp('🎵 Audio file detected:', file.originalname);
    }
    cb(null, true);
  } else {
    logWithTimestamp('❌ Invalid file type:', file.mimetype)
    cb(null, false);
  }
  }
});


// Health check endpoint
router.get('/test', (req, res) => {
  logWithTimestamp('Upload test route hit');
  
  try {
    const stats = fs.statSync(uploadDir);
    res.json({
      success: true,
      message: 'Upload routes are working!',
      timestamp: new Date().toISOString(),
      uploadDir: uploadDir,
      uploadsExists: fs.existsSync(uploadDir),
      isDirectory: stats.isDirectory(),
      platform: process.platform,
      nodeVersion: process.version,
      permissions: stats.mode.toString(8)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// FIXED: Upload route with better error handling and timeouts
router.post('/project', authenticateToken, (req: Request, res: Response) => {
  logWithTimestamp('=== UPLOAD PROJECT ROUTE HIT ===');
  logWithTimestamp('User from auth:', req.user);
  logWithTimestamp('Content-Type:', req.get('Content-Type'));
  logWithTimestamp('Content-Length:', req.get('Content-Length'));
  
  // Set a response timeout
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      logWithTimestamp('❌ Response timeout after 45 seconds');
      res.status(408).json({
        success: false,
        error: {
          message: 'Upload timeout - server took too long to process the file',
          code: 'SERVER_TIMEOUT'
        }
      });
    }
  }, 45000); // 45 second timeout

  logWithTimestamp('🔄 Starting multer processing...');
  
  // Enhanced multer error handling
  const multerMiddleware = upload.single('audioFile');
  
  multerMiddleware(req, res, async (multerError) => {
    clearTimeout(responseTimeout);
    
    if (res.headersSent) {
      logWithTimestamp('⚠️ Response already sent, aborting');
      return;
    }
    
    logWithTimestamp('🔄 Multer callback executed');
    
    if (multerError) {
      logWithTimestamp('❌ Multer error details:', {
        name: multerError.name,
        message: multerError.message,
        code: (multerError as any).code,
        field: (multerError as any).field,
        stack: multerError.stack?.substring(0, 500) // Truncate stack
      });
      
      let errorMessage = 'File upload failed';
      let errorCode = 'MULTER_ERROR';
      
      if (multerError.message.includes('File too large')) {
        errorMessage = 'File is too large. Maximum size is 100MB.';
        errorCode = 'FILE_TOO_LARGE';
      } else if (multerError.message.includes('Invalid file type')) {
        errorMessage = multerError.message;
        errorCode = 'INVALID_FILE_TYPE';
      } else if (multerError.message.includes('Unexpected field')) {
        errorMessage = 'Invalid form field. Expected "audioFile".';
        errorCode = 'INVALID_FIELD';
      }
      
      return res.status(400).json({
        success: false,
        error: {
          message: errorMessage,
          code: errorCode,
          details: process.env.NODE_ENV === 'development' ? multerError.message : undefined
        }
      });
    }

    logWithTimestamp('✅ Multer processing completed successfully');
    
    if (!req.file) {
      logWithTimestamp('❌ No file in request after multer');
      return res.status(400).json({
        success: false,
        error: {
          message: 'No audio file provided',
          code: 'NO_FILE'
        }
      });
    }

    logWithTimestamp('📁 File details after multer:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      destination: req.file.destination
    });

    // Verify file was actually written
    try {
      const fileStats = fs.statSync(req.file.path);
      logWithTimestamp('📊 File verification:', {
        exists: true,
        size: fileStats.size,
        expectedSize: req.file.size,
        sizeMatch: fileStats.size === req.file.size
      });
      
      if (fileStats.size !== req.file.size) {
        throw new Error(`File size mismatch: expected ${req.file.size}, got ${fileStats.size}`);
      }
    } catch (fileError) {
      logWithTimestamp('❌ File verification failed:', fileError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'File was not properly uploaded',
          code: 'FILE_VERIFICATION_FAILED'
        }
      });
    }

    logWithTimestamp('📝 Request body:', req.body);

    try {
      const { title, description } = req.body;
      const userId = req.user!.userId;

      if (!title || title.trim() === '') {
        logWithTimestamp('❌ No title provided');
        // Clean up file
        try {
          fs.unlinkSync(req.file.path);
          logWithTimestamp('🧹 Cleaned up file due to missing title');
        } catch (cleanupError) {
          logWithTimestamp('⚠️ Failed to cleanup file:', cleanupError);
        }
        
        return res.status(400).json({
          success: false,
          error: {
            message: 'Project title is required',
            code: 'TITLE_REQUIRED'
          }
        });
      }

      logWithTimestamp('🔍 Testing database connection...');
      const dbTest = await pool.query('SELECT NOW() as current_time');
      logWithTimestamp('✅ Database connection OK:', dbTest.rows[0]);

      logWithTimestamp('🔄 Starting database transaction...');
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        logWithTimestamp('✅ Transaction started');

        const shareLink = generateShareLink();
        const projectId = uuidv4();
        const now = new Date();
        
        const defaultSettings = {
          allowDownload: true,
          watermarkPreviews: false,
          autoExpire: false,
          maxCollaborators: 5,
          requireApproval: false
        };

        logWithTimestamp('💾 Creating project record...');
        const projectResult = await client.query(`
          INSERT INTO projects (id, title, creator_id, status, share_link, settings, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [projectId, title.trim(), userId, 'active', shareLink, JSON.stringify(defaultSettings), now, now]);

        logWithTimestamp('✅ Project created:', {
          id: projectResult.rows[0].id,
          title: projectResult.rows[0].title
        });

        const audioFileId = uuidv4();
        const fileUrl = `/upload/audio/${req.file.filename}`;
        
        logWithTimestamp('💾 Creating audio file record...');
        const audioFileResult = await client.query(`
          INSERT INTO audio_files (
            id, project_id, version, filename, original_filename, file_url,
            duration, sample_rate, file_size, mime_type, uploaded_by, uploaded_at, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          audioFileId, projectId, '1.0', req.file.filename, req.file.originalname,
          fileUrl, 0, 44100, req.file.size, req.file.mimetype, userId, now, true
        ]);

        logWithTimestamp('✅ Audio file record created:', {
          id: audioFileResult.rows[0].id,
          filename: audioFileResult.rows[0].filename
        });

        await client.query('COMMIT');
        logWithTimestamp('✅ Transaction committed successfully');

        const responseData = {
          success: true,
          data: {
            project: {
              id: projectResult.rows[0].id,
              title: projectResult.rows[0].title,
              creatorId: projectResult.rows[0].creator_id,
              status: projectResult.rows[0].status,
              shareLink: projectResult.rows[0].share_link,
              createdAt: projectResult.rows[0].created_at,
              updatedAt: projectResult.rows[0].updated_at
            },
            audioFile: {
              id: audioFileResult.rows[0].id,
              projectId: audioFileResult.rows[0].project_id,
              version: audioFileResult.rows[0].version,
              filename: audioFileResult.rows[0].filename,
              originalFilename: audioFileResult.rows[0].original_filename,
              fileUrl: audioFileResult.rows[0].file_url,
              fileSize: audioFileResult.rows[0].file_size,
              mimeType: audioFileResult.rows[0].mime_type,
              uploadedAt: audioFileResult.rows[0].uploaded_at,
              duration: 0 // We'll calculate this later or in the frontend
            }
          }
        };

        logWithTimestamp('✅ Sending success response');
        res.status(201).json(responseData);

      } catch (dbError) {
        await client.query('ROLLBACK');
        logWithTimestamp('❌ Database transaction error:', {
          message: (dbError as Error).message,
          stack: (dbError as Error).stack?.substring(0, 500)
        });
        throw dbError;
      } finally {
        client.release();
        logWithTimestamp('🔄 Database client released');
      }

    } catch (error) {
      logWithTimestamp('❌ Processing error:', {
        message: (error as Error).message,
        stack: (error as Error).stack?.substring(0, 500)
      });
      
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          logWithTimestamp('🧹 Cleaned up file on error');
        } catch (cleanupError) {
          logWithTimestamp('❌ Failed to cleanup file:', cleanupError);
        }
      }

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            message: 'Upload processing failed',
            code: 'PROCESSING_ERROR',
            details: process.env.NODE_ENV === 'development' 
              ? (error as CustomError).message 
              : undefined
          }
        });
      }
    }
  });
});

// Static file serving with proper headers
router.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);
  
  logWithTimestamp('📥 Audio file request:', {
    filename,
    filePath,
    exists: fs.existsSync(filePath)
  });

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: { message: 'Audio file not found' }
    });
  }

  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = 'application/octet-stream';
    switch (ext) {
      case '.mp3': contentType = 'audio/mpeg'; break;
      case '.wav': contentType = 'audio/wav'; break;
      case '.m4a': contentType = 'audio/mp4'; break;
      case '.ogg': contentType = 'audio/ogg'; break;
      case '.flac': contentType = 'audio/flac'; break;
      case '.aiff': contentType = 'audio/aiff'; break;
    }

    res.set({
      'Content-Type': contentType,
      'Content-Length': stats.size.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range'
    });

    // Handle range requests for audio streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Content-Length': chunksize.toString()
      });
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.sendFile(filePath);
    }
  } catch (error) {
    logWithTimestamp('❌ Error serving audio file:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to serve audio file' }
    });
  }
});

function generateShareLink(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Upload image endpoint
router.post('/image', 
  authenticateToken, 
  upload.single('image'), 
  async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No image file provided' }
        });
      }

      // Validate it's actually an image
      if (!req.file.mimetype.startsWith('image/')) {
        // Clean up file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: { message: 'File must be an image' }
        });
      }

      // Size check for images (5MB max)
      if (req.file.size > 5 * 1024 * 1024) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: { message: 'Image must be less than 5MB' }
        });
      }

      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const imageUrl = `${baseUrl}/images/${req.file.filename}`;

      logWithTimestamp('✅ Image uploaded successfully:', {
        filename: req.file.filename,
        size: req.file.size,
        url: imageUrl
      });
      
      res.json({
        success: true,
        data: {
          url: imageUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size
        },
        message: 'Image uploaded successfully'
      });

    } catch (error: any) {
      logWithTimestamp('❌ Image upload error:', error);
      
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logWithTimestamp('❌ Failed to clean up file:', unlinkError);
        }
      }

      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to upload image' }
      });
    }
  }
);

// Serve uploaded images
router.get('/images/:filename', (req: any, res: any) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(imageUploadDir, filename);
    
    logWithTimestamp('📥 Image file request:', {
      filename,
      imagePath,
      exists: fs.existsSync(imagePath)
    });

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: { message: 'Image not found' }
      });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*'
    });

    res.sendFile(imagePath);

  } catch (error: any) {
    logWithTimestamp('❌ Error serving image file:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to serve image' }
    });
  }
});


export default router;