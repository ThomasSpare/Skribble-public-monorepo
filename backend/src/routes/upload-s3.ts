// backend/src/routes/upload-s3.ts - Updated upload route using S3
import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { uploadAudioS3, uploadAudioToS3 } from '../middleware/upload-s3';
import { s3UploadService } from '../services/s3-upload';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const logWithTimestamp = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// Health check - test S3 connection
router.get('/test-s3', async (req, res) => {
  try {
    const isConnected = await s3UploadService.testConnection();
    res.json({
      success: true,
      s3Connected: isConnected,
      timestamp: new Date().toISOString(),
      bucket: process.env.S3_BUCKET_NAME,
      region: process.env.AWS_REGION
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Upload project with S3 storage
router.post('/project', authenticateToken, (req: Request, res: Response) => {
  logWithTimestamp('=== S3 UPLOAD PROJECT ROUTE HIT ===');
  logWithTimestamp('User from auth:', req.user);
  
  // Set response timeout
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      logWithTimestamp('❌ Response timeout after 60 seconds');
      res.status(408).json({
        success: false,
        error: {
          message: 'Upload timeout - server took too long to process the file',
          code: 'SERVER_TIMEOUT'
        }
      });
    }
  }, 60000); // 60 second timeout for S3 uploads

  const multerMiddleware = uploadAudioS3.single('audioFile');
  
  multerMiddleware(req, res, async (multerError) => {
    clearTimeout(responseTimeout);
    
    if (res.headersSent) {
      logWithTimestamp('⚠️ Response already sent, aborting');
      return;
    }
    
    if (multerError) {
      logWithTimestamp('❌ Multer error:', multerError.message);
      
      let errorMessage = 'File upload failed';
      let errorCode = 'MULTER_ERROR';
      
      if (multerError.message.includes('File too large')) {
        errorMessage = 'File is too large. Maximum size is 100MB.';
        errorCode = 'FILE_TOO_LARGE';
      } else if (multerError.message.includes('Invalid file type')) {
        errorMessage = multerError.message;
        errorCode = 'INVALID_FILE_TYPE';
      }
      
      return res.status(400).json({
        success: false,
        error: { message: errorMessage, code: errorCode }
      });
    }

    if (!req.file) {
      logWithTimestamp('❌ No file received');
      return res.status(400).json({
        success: false,
        error: { message: 'No audio file provided', code: 'NO_FILE' }
      });
    }

    const { title, description } = req.body;
    const userId = req.user!.userId;

    logWithTimestamp('📝 Processing upload:', {
      title,
      description,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      userId
    });

    try {
      // Start database transaction
      const client = await pool.connect();
      await client.query('BEGIN');

      try {
        // Create project first
        const projectResult = await client.query(`
          INSERT INTO projects (id, title, description, creator_id, status, created_at)
          VALUES ($1, $2, $3, $4, 'active', NOW())
          RETURNING *
        `, [uuidv4(), title || 'Untitled Project', description || '', userId]);

        const project = projectResult.rows[0];
        logWithTimestamp('✅ Project created:', project.id);

        // Upload file to S3 (projectId is required for audio uploads)
        const s3Result = await uploadAudioToS3(req.file, project.id);
        logWithTimestamp('✅ S3 upload completed:', s3Result);

        // Save audio file record to database
        const audioFileResult = await client.query(`
          INSERT INTO audio_files (
            id, project_id, filename, original_filename, file_url, 
            s3_key, file_size, mime_type, version, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'v1.0', NOW())
          RETURNING *
        `, [
          uuidv4(),
          project.id,
          req.file.originalname,
          req.file.originalname,
          s3Result.location,
          s3Result.key,
          req.file.size,
          req.file.mimetype
        ]);

        const audioFile = audioFileResult.rows[0];
        logWithTimestamp('✅ Audio file record created:', audioFile.id);

        // Commit transaction
        await client.query('COMMIT');

        res.json({
          success: true,
          data: {
            project: {
              ...project,
              audioFiles: [audioFile]
            },
            s3Data: s3Result
          }
        });

      } catch (dbError) {
        // Rollback transaction
        await client.query('ROLLBACK');
        
        // Try to clean up S3 file if it was uploaded
        if (req.file) {
          try {
            // We don't have the S3 key here if DB failed, so this might not work
            // Consider implementing a cleanup job
            logWithTimestamp('⚠️ Database error, may need S3 cleanup');
          } catch (cleanupError) {
            logWithTimestamp('⚠️ S3 cleanup failed:', cleanupError);
          }
        }
        
        throw dbError;
      } finally {
        client.release();
      }

    } catch (error) {
      logWithTimestamp('❌ Upload error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to process upload',
            code: 'UPLOAD_ERROR'
          }
        });
      }
    }
  });
});

// Get file download URL (signed URL for security)
router.get('/download/:fileId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = req.user!.userId;

    // Get file info and check permissions
    const result = await pool.query(`
      SELECT af.*, p.creator_id, p.title as project_title
      FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      WHERE af.id = $1
    `, [fileId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'File not found' }
      });
    }

    const file = result.rows[0];

    // Check if user has access (creator or collaborator)
    if (file.creator_id !== userId) {
      // Check if user is a collaborator
      const collaboratorCheck = await pool.query(`
        SELECT 1 FROM project_collaborators 
        WHERE project_id = $1 AND user_id = $2
      `, [file.project_id, userId]);

      if (collaboratorCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied' }
        });
      }
    }

    // Generate signed URL (expires in 1 hour)
    const signedUrl = await s3UploadService.getSignedDownloadUrl(file.s3_key, 3600);

    res.json({
      success: true,
      data: {
        downloadUrl: signedUrl,
        filename: file.original_filename,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      }
    });

  } catch (error) {
    logWithTimestamp('❌ Download URL error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate download URL' }
    });
  }
});

// Delete file from S3 and database
router.delete('/file/:fileId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = req.user!.userId;

    // Get file info and check permissions
    const result = await pool.query(`
      SELECT af.*, p.creator_id
      FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      WHERE af.id = $1 AND p.creator_id = $2
    `, [fileId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'File not found or access denied' }
      });
    }

    const file = result.rows[0];

    // Delete from S3
    await s3UploadService.deleteFile(file.s3_key);

    // Delete from database
    await pool.query('DELETE FROM audio_files WHERE id = $1', [fileId]);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    logWithTimestamp('❌ File deletion error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete file' }
    });
  }
});

export default router;