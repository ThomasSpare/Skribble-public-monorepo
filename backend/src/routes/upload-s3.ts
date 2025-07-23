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
      userId,
      hasBuffer: !!req.file.buffer,
      bufferSize: req.file.buffer?.length
    });

    // ENHANCED: Validate file buffer
    if (!req.file.buffer || req.file.buffer.length === 0) {
      logWithTimestamp('❌ Invalid file buffer');
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid file: empty buffer', code: 'INVALID_BUFFER' }
      });
    }

    let client;
    try {
      // Start database transaction
      client = await pool.connect();
      await client.query('BEGIN');

      try {
        // Create project first
        const projectId = uuidv4();
        const projectResult = await client.query(`
          INSERT INTO projects (id, title, description, creator_id, status, created_at)
          VALUES ($1, $2, $3, $4, 'active', NOW())
          RETURNING *
        `, [projectId, title || 'Untitled Project', description || '', userId]);

        const project = projectResult.rows[0];
        logWithTimestamp('✅ Project created:', {
          id: project.id,
          title: project.title,
          creator_id: project.creator_id
        });

        // ENHANCED: Upload file to S3 with detailed logging
        logWithTimestamp('🎵 Starting S3 upload for project:', project.id);
        
        const s3Result = await uploadAudioToS3(req.file, project.id);
        
        // CRITICAL: Validate S3 result
        if (!s3Result || !s3Result.key || !s3Result.location) {
          throw new Error(`S3 upload returned invalid result: ${JSON.stringify(s3Result)}`);
        }

        logWithTimestamp('✅ S3 upload completed:', s3Result);

        // ENHANCED: Validate S3 key format
        const expectedKeyPrefix = `projects/${project.id}/audio/`;
        if (!s3Result.key.startsWith(expectedKeyPrefix)) {
          logWithTimestamp('⚠️ Unexpected S3 key format:', {
            expected: expectedKeyPrefix,
            actual: s3Result.key
          });
        }

        // Save audio file record to database
        const audioFileId = uuidv4();
        const audioFileResult = await client.query(`
          INSERT INTO audio_files (
            id, project_id, filename, original_filename, file_url, 
            s3_key, file_size, mime_type, version, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'v1.0', NOW())
          RETURNING *
        `, [
          audioFileId,
          project.id,
          req.file.originalname,
          req.file.originalname,
          s3Result.location,
          s3Result.key,           // This should NEVER be null
          req.file.size,
          req.file.mimetype
        ]);

        const audioFile = audioFileResult.rows[0];
        
        // CRITICAL: Verify the s3_key was saved correctly
        if (!audioFile.s3_key) {
          throw new Error('Database insert failed: s3_key is null after insert');
        }

        logWithTimestamp('✅ Audio file record created:', {
          id: audioFile.id,
          s3_key: audioFile.s3_key,
          filename: audioFile.filename,
          file_size: audioFile.file_size
        });

        // Commit transaction
        await client.query('COMMIT');
        logWithTimestamp('✅ Transaction committed successfully');

        // ENHANCED: Test the created S3 key immediately
        try {
          const testUrl = await s3UploadService.getSignedDownloadUrl(audioFile.s3_key, 60);
          logWithTimestamp('✅ S3 key validation successful - signed URL generated');
        } catch (testError) {
          logWithTimestamp('⚠️ S3 key validation failed:', testError.message);
          // Don't fail the request, but log the issue
        }

        res.json({
          success: true,
          data: {
            project: {
              ...project,
              audioFiles: [audioFile]
            },
            s3Data: s3Result,
            validation: {
              s3KeyExists: !!audioFile.s3_key,
              s3KeyFormat: audioFile.s3_key?.startsWith(expectedKeyPrefix)
            }
          }
        });

      } catch (uploadError) {
        // Rollback transaction
        await client.query('ROLLBACK');
        logWithTimestamp('❌ Rolling back transaction due to error:', uploadError.message);
        
        // Try to clean up S3 file if it was uploaded
        if (req.file && uploadError.message.includes('Database')) {
          try {
            // Try to extract S3 key from error context if available
            logWithTimestamp('🧹 Attempting S3 cleanup after database error');
            // Note: We might not have the S3 key here, which is why we need better error handling
          } catch (cleanupError) {
            logWithTimestamp('⚠️ S3 cleanup failed:', cleanupError.message);
          }
        }
        
        throw uploadError; // Re-throw to be caught by outer catch
      }

    } catch (error) {
      logWithTimestamp('❌ Upload process failed:', {
        message: error.message,
        stack: error.stack,
        phase: error.message.includes('S3') ? 'S3_UPLOAD' : 
               error.message.includes('Database') ? 'DATABASE' : 'UNKNOWN'
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isS3Error = errorMessage.includes('S3');
      const isDatabaseError = errorMessage.includes('Database') || errorMessage.includes('INSERT');
      
      let userMessage = 'Upload failed. Please try again.';
      let errorCode = 'UPLOAD_ERROR';
      
      if (isS3Error) {
        userMessage = 'Failed to upload file to storage. Please check your connection and try again.';
        errorCode = 'S3_ERROR';
      } else if (isDatabaseError) {
        userMessage = 'Failed to save project information. Please try again.';
        errorCode = 'DATABASE_ERROR';
      }
      
      res.status(500).json({
        success: false,
        error: { 
          message: userMessage,
          code: errorCode,
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }
      });
    } finally {
      // Release database client
      if (client) {
        client.release();
      }
    }
  });
});

// Get file download URL (signed URL for security)
// Add this to your upload-s3.ts file (or create the endpoint if missing)

// Get file download URL (signed URL for security)
router.get('/download/:fileId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = req.user!.userId;

    logWithTimestamp('🔗 Download URL requested for file:', fileId);
    logWithTimestamp('👤 Requested by user:', userId);

    // FIXED: Add proper null checking
    if (!fileId) {
      logWithTimestamp('❌ No file ID provided');
      return res.status(400).json({
        success: false,
        error: { message: 'File ID is required' }
      });
    }

    // Get file info and check permissions
    const result = await pool.query(`
      SELECT af.*, p.creator_id, p.title as project_title
      FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      WHERE af.id = $1
    `, [fileId]);

    // FIXED: Check if result exists and has rows
    if (!result || !result.rows || result.rows.length === 0) {
      logWithTimestamp('❌ File not found in database:', fileId);
      return res.status(404).json({
        success: false,
        error: { message: 'File not found' }
      });
    }

    const file = result.rows[0];
    logWithTimestamp('✅ File found:', {
      filename: file.filename,
      s3_key: file.s3_key,
      project_title: file.project_title,
      creator_id: file.creator_id
    });

    // Check if user has access (creator or collaborator)
    if (file.creator_id !== userId) {
      // Check if user is a collaborator
      const collaboratorCheck = await pool.query(`
        SELECT 1 FROM project_collaborators 
        WHERE project_id = $1 AND user_id = $2 AND status = 'accepted'
      `, [file.project_id, userId]);

      if (!collaboratorCheck || !collaboratorCheck.rows || collaboratorCheck.rows.length === 0) {
        logWithTimestamp('❌ Access denied for user:', userId);
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied' }
        });
      }
    }

    // Check if file has S3 key
    if (!file.s3_key) {
      logWithTimestamp('❌ File missing S3 key:', fileId);
      return res.status(400).json({
        success: false,
        error: { message: 'File not available - missing S3 key' }
      });
    }

    // Generate signed URL (expires in 1 hour)
    logWithTimestamp('🔗 Generating signed URL for S3 key:', file.s3_key);
    
    try {
      const signedUrl = await s3UploadService.getSignedDownloadUrl(file.s3_key, 3600);
      
      logWithTimestamp('✅ Signed URL generated successfully');
      
      res.json({
        success: true,
        data: {
          downloadUrl: signedUrl,
          filename: file.original_filename || file.filename,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          fileSize: file.file_size,
          mimeType: file.mime_type
        }
      });

    } catch (s3Error) {
      logWithTimestamp('❌ S3 signed URL generation failed:', s3Error);
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to generate download URL' }
      });
    }

  } catch (error) {
    logWithTimestamp('❌ Download URL error:', error);
    
    // FIXED: Better error handling to prevent null.length errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    logWithTimestamp('Error details:', { message: errorMessage, stack: errorStack });
    
    res.status(500).json({
      success: false,
      error: { 
        message: 'Failed to generate download URL',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      }
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

router.get('/debug-s3', authenticateToken, async (req: Request, res: Response) => {
  try {
    logWithTimestamp('🔍 Debug S3 status requested');

    // 1. Check S3 connection
    const s3Connected = await s3UploadService.testConnection();
    
    // 2. Check environment variables
    const envStatus = {
      AWS_REGION: !!process.env.AWS_REGION,
      AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
      S3_BUCKET_NAME: !!process.env.S3_BUCKET_NAME,
      // Show values for debugging (be careful in production!)
      AWS_REGION_VALUE: process.env.AWS_REGION,
      S3_BUCKET_NAME_VALUE: process.env.S3_BUCKET_NAME,
      AWS_ACCESS_KEY_PLACEHOLDER: process.env.AWS_ACCESS_KEY_ID?.includes('your-aws') || false
    };

    // 3. Count files with/without S3 keys
    const fileStats = await pool.query(`
      SELECT 
        COUNT(*) as total_files,
        COUNT(s3_key) as files_with_s3_key,
        COUNT(*) - COUNT(s3_key) as files_missing_s3_key
      FROM audio_files
    `);

    // 4. Get recent files with issues
    const problematicFiles = await pool.query(`
      SELECT 
        af.id, af.filename, af.s3_key, af.created_at,
        p.title as project_title, p.creator_id
      FROM audio_files af
      JOIN projects p ON af.project_id = p.id  
      WHERE af.s3_key IS NULL
      ORDER BY af.created_at DESC
      LIMIT 5
    `);

    // 5. Test generating a sample S3 key
    let sampleS3Key = null;
    try {
      // This is just to test the key generation, not actual upload
      const testProjectId = 'test-project-id';
      sampleS3Key = `projects/${testProjectId}/audio/test-file.mp3`;
    } catch (keyError) {
      logWithTimestamp('❌ S3 key generation test failed:', keyError);
    }

    res.json({
      success: true,
      debug: {
        s3Connection: s3Connected,
        environment: envStatus,
        fileStatistics: fileStats.rows[0],
        problematicFiles: problematicFiles.rows,
        sampleS3Key,
        recommendations: [
          envStatus.AWS_ACCESS_KEY_PLACEHOLDER ? 'Update AWS credentials in environment' : 'AWS credentials look set',
          !s3Connected ? 'S3 connection failed - check credentials and bucket' : 'S3 connection working',
          fileStats.rows[0].files_missing_s3_key > 0 ? `${fileStats.rows[0].files_missing_s3_key} files need S3 key migration` : 'All files have S3 keys'
        ]
      }
    });

  } catch (error) {
    logWithTimestamp('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Public download endpoint for viewer access
router.get('/viewer-download/:viewerToken/:audioFileId', async (req: Request, res: Response) => {
  try {
    const { viewerToken, audioFileId } = req.params;
    
    logWithTimestamp('🔓 Public viewer download requested:', { viewerToken: viewerToken.substring(0, 8) + '...', audioFileId });

    // Validate viewer token and get project access
    const viewerQuery = await pool.query(`
      SELECT 
        pv.project_id, 
        pv.expires_at,
        af.file_url,
        af.s3_key,
        af.filename,
        af.original_filename
      FROM project_viewer_links pv
      JOIN projects p ON pv.project_id = p.id
      JOIN audio_files af ON p.id = af.project_id
      WHERE pv.viewer_token = $1 
        AND af.id = $2 
        AND pv.expires_at > NOW()
        AND af.is_active = true
    `, [viewerToken, audioFileId]);

    if (viewerQuery.rows.length === 0) {
      logWithTimestamp('❌ Invalid viewer token or audio file');
      return res.status(404).json({
        success: false,
        error: { message: 'Invalid viewer link or audio file not found', code: 'INVALID_VIEWER_ACCESS' }
      });
    }

    const audioFile = viewerQuery.rows[0];
    
    // Update viewer link usage
    await pool.query(`
      UPDATE project_viewer_links 
      SET last_accessed_at = NOW()
      WHERE viewer_token = $1
    `, [viewerToken]);

    // Generate signed URL for S3 file
    let downloadUrl;
    
    if (audioFile.s3_key) {
      // S3 file - generate signed URL
      try {
        downloadUrl = await s3UploadService.getSignedDownloadUrl(audioFile.s3_key, 3600); // 1 hour expiry
        logWithTimestamp('✅ Generated signed URL for viewer access');
      } catch (s3Error) {
        logWithTimestamp('❌ S3 signed URL generation failed:', s3Error);
        return res.status(500).json({
          success: false,
          error: { message: 'Failed to generate download link', code: 'S3_ERROR' }
        });
      }
    } else if (audioFile.file_url) {
      // Local file or already processed URL
      downloadUrl = audioFile.file_url.startsWith('http') 
        ? audioFile.file_url 
        : `${process.env.API_BASE_URL || 'http://localhost:5000'}${audioFile.file_url}`;
      logWithTimestamp('✅ Using direct file URL for viewer access');
    } else {
      logWithTimestamp('❌ No file URL available');
      return res.status(404).json({
        success: false,
        error: { message: 'Audio file not accessible', code: 'FILE_NOT_ACCESSIBLE' }
      });
    }

    res.json({
      success: true,
      data: {
        downloadUrl,
        filename: audioFile.original_filename || audioFile.filename,
        expiresIn: 3600, // 1 hour
        isViewerAccess: true
      }
    });

  } catch (error) {
    logWithTimestamp('❌ Viewer download error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get download link',
        code: 'VIEWER_DOWNLOAD_ERROR'
      }
    });
  }
});

export default router;