// backend/src/routes/versions.ts - FIXED VERSION
import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { uploadAudioVersion, cleanupFile, validateUploadedFile } from '../middleware/upload';
import { pool } from '../config/database';

const router = express.Router();

const logWithTimestamp = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// Helper function to get next version number
async function getNextVersionNumber(projectId: string): Promise<number> {
  const result = await pool.query(
    'SELECT MAX(version_number) as max_version FROM audio_files WHERE project_id = $1',
    [projectId]
  );
  return (result.rows[0].max_version || 0) + 1;
}

// Upload new version - FIXED URL PATTERN
router.post('/:projectId/versions', 
  authenticateToken, 
  (req: Request, res: Response) => {
    // Set response timeout
    const responseTimeout = setTimeout(() => {
      if (!res.headersSent) {
        logWithTimestamp('❌ Version upload timeout');
        res.status(408).json({
          success: false,
          error: {
            message: 'Upload timeout - server took too long to process the file',
            code: 'SERVER_TIMEOUT'
          }
        });
      }
    }, 60000); // 60 second timeout for versions

    const multerMiddleware = uploadAudioVersion.single('audioFile');
    
    multerMiddleware(req, res, async (multerError) => {
      clearTimeout(responseTimeout);
      
      if (res.headersSent) {
        logWithTimestamp('⚠️ Response already sent, aborting');
        return;
      }

      if (multerError) {
        logWithTimestamp('❌ Multer error in version upload:', multerError.message);
        
        let errorMessage = 'File upload failed';
        let errorCode = 'MULTER_ERROR';
        
        if (multerError.message.includes('File too large')) {
          errorMessage = 'File is too large. Maximum size is 200MB for versions.';
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
        logWithTimestamp('❌ No file provided for version upload');
        return res.status(400).json({
          success: false,
          error: { message: 'No audio file provided', code: 'NO_FILE' }
        });
      }

      // Validate the uploaded file
      if (!validateUploadedFile(req.file)) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          success: false,
          error: { message: 'File validation failed', code: 'FILE_VALIDATION_FAILED' }
        });
      }

      const { projectId } = req.params;
      const { versionNotes } = req.body;
      const userId = req.user!.userId;

      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Check if user has permission to upload to this project
        const permissionCheck = await client.query(`
          SELECT p.creator_id, pc.role 
          FROM projects p
          LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
          WHERE p.id = $1
        `, [projectId, userId]);

        if (permissionCheck.rows.length === 0) {
          throw new Error('Project not found');
        }

        const { creator_id, role } = permissionCheck.rows[0];
        const canUpload = creator_id === userId || ['admin', 'producer'].includes(role);

        if (!canUpload) {
          throw new Error('Permission denied - insufficient privileges to upload versions');
        }
        
        // Get next version number
        const nextVersion = await getNextVersionNumber(projectId);
        
        // Mark all previous versions as not current
        await client.query(`
          UPDATE audio_files 
          SET is_current_version = false 
          WHERE project_id = $1
        `, [projectId]);
        
        // Create new audio file record
        const audioFileId = uuidv4();
        const fileUrl = `/uploads/audio/${req.file.filename}`; // FIXED: /uploads/ instead of /upload/
        const now = new Date();
        
        const newAudioFile = await client.query(`
          INSERT INTO audio_files (
            id, project_id, version, version_number, filename, original_filename, 
            file_url, file_size, mime_type, uploaded_by, version_notes,
            is_current_version, uploaded_at, is_active, duration, sample_rate
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *
        `, [
          audioFileId, projectId, `v${nextVersion}`, nextVersion, req.file.filename,
          req.file.originalname, fileUrl, req.file.size, req.file.mimetype, 
          userId, versionNotes || null, true, now, true, 0, 44100
        ]);
        
        // Add to version history
        await client.query(`
          INSERT INTO version_history (
            project_id, audio_file_id, version_number, 
            change_type, change_summary, user_id
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [projectId, audioFileId, nextVersion, 'upload', versionNotes || `Version ${nextVersion} uploaded`, userId]);
        
        // Update project's updated_at timestamp
        await client.query(`
          UPDATE projects 
          SET updated_at = $1 
          WHERE id = $2
        `, [now, projectId]);
        
        await client.query('COMMIT');
                
        res.json({
          success: true,
          data: {
            audioFile: newAudioFile.rows[0],
            versionNumber: nextVersion,
            message: `Version ${nextVersion} uploaded successfully`
          }
        });
        
      } catch (error) {
        await client.query('ROLLBACK');
        logWithTimestamp('❌ Version upload failed:', error);
        
        // Clean up uploaded file on error
        cleanupFile(req.file.path);
        
        res.status(500).json({ 
          success: false, 
          error: { 
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'VERSION_UPLOAD_FAILED'
          }
        });
      } finally {
        client.release();
      }
    });
  }
);

// Get all versions for a project - FIXED URL PATTERN
router.get('/:projectId/versions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
        
    // Check if user has access to this project
    const accessCheck = await pool.query(`
      SELECT p.creator_id, pc.role 
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1
    `, [projectId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', code: 'PROJECT_NOT_FOUND' }
      });
    }

    const { creator_id, role } = accessCheck.rows[0];
    const hasAccess = creator_id === userId || role !== null;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }
    
    const versionsQuery = `
      SELECT 
        af.*,
        u.username as uploaded_by_name,
        u.email as uploaded_by_email,
        (SELECT COUNT(*) FROM annotations WHERE audio_file_id = af.id) as annotation_count
      FROM audio_files af
      JOIN users u ON af.uploaded_by = u.id
      WHERE af.project_id = $1 AND af.is_active = true
      ORDER BY af.version_number DESC
    `;
    
    const result = await pool.query(versionsQuery, [projectId]);
        
    res.json({
      success: true,
      data: {
        versions: result.rows,
        currentVersion: result.rows.find(v => v.is_current_version),
        totalVersions: result.rows.length
      }
    });
    
  } catch (error) {
    logWithTimestamp('❌ Error fetching versions:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        message: 'Failed to fetch versions',
        code: 'FETCH_VERSIONS_FAILED'
      }
    });
  }
});

// Switch to specific version - FIXED URL PATTERN
router.post('/:projectId/versions/:versionNumber/activate', 
  authenticateToken, 
  async (req: Request, res: Response) => {
    const { projectId, versionNumber } = req.params;
    const userId = req.user!.userId;    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check permissions
      const permissionCheck = await client.query(`
        SELECT p.creator_id, pc.role 
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
        WHERE p.id = $1
      `, [projectId, userId]);

      if (permissionCheck.rows.length === 0) {
        throw new Error('Project not found');
      }

      const { creator_id, role } = permissionCheck.rows[0];
      const canSwitch = creator_id === userId || ['admin', 'producer'].includes(role);

      if (!canSwitch) {
        throw new Error('Permission denied - insufficient privileges to switch versions');
      }
      
      // Mark all versions as not current
      await client.query(`
        UPDATE audio_files 
        SET is_current_version = false 
        WHERE project_id = $1
      `, [projectId]);
      
      // Activate the selected version
      const result = await client.query(`
        UPDATE audio_files 
        SET is_current_version = true 
        WHERE project_id = $1 AND version_number = $2 AND is_active = true
        RETURNING *
      `, [projectId, parseInt(versionNumber)]);
      
      if (result.rows.length === 0) {
        throw new Error(`Version ${versionNumber} not found`);
      }
      
      // Log the version switch in history
      await client.query(`
        INSERT INTO version_history (
          project_id, audio_file_id, version_number, 
          change_type, change_summary, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        projectId, result.rows[0].id, parseInt(versionNumber), 
        'restore', `Switched to version ${versionNumber}`, userId
      ]);
      
      // Update project timestamp
      await client.query(`
        UPDATE projects 
        SET updated_at = $1 
        WHERE id = $2
      `, [new Date(), projectId]);
      
      await client.query('COMMIT');
      
      logWithTimestamp('✅ Version switch completed');
      
      res.json({
        success: true,
        data: { 
          activeVersion: result.rows[0],
          message: `Switched to version ${versionNumber}`
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      logWithTimestamp('❌ Version switch failed:', error);
      res.status(500).json({ 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'VERSION_SWITCH_FAILED'
        }
      });
    } finally {
      client.release();
    }
  }
);

// Get version history/activity log - FIXED URL PATTERN
router.get('/:projectId/versions/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    
    // Check access
    const accessCheck = await pool.query(`
      SELECT p.creator_id, pc.role 
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1
    `, [projectId, userId]);

    if (accessCheck.rows.length === 0 || 
        (accessCheck.rows[0].creator_id !== userId && !accessCheck.rows[0].role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }
    
    const historyQuery = `
      SELECT 
        vh.*,
        u.username as user_name,
        af.original_filename,
        af.file_size
      FROM version_history vh
      JOIN users u ON vh.user_id = u.id
      LEFT JOIN audio_files af ON vh.audio_file_id = af.id
      WHERE vh.project_id = $1
      ORDER BY vh.created_at DESC
      LIMIT 50
    `;
    
    const result = await pool.query(historyQuery, [projectId]);
    
    res.json({
      success: true,
      data: { history: result.rows }
    });
    
  } catch (error) {
    logWithTimestamp('❌ Error fetching version history:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to fetch version history' }
    });
  }
});

export default router;