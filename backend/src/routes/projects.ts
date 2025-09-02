// backend/src/routes/projects.ts
import express, { Request, Response } from 'express';
import { body, validationResult, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../config/database';
import { S3ImageProcessor } from '../utils/s3ImageProcessor';

const router = express.Router();
interface CustomError extends Error {
  message: string;
}

const safeJSONParse = (data: any, defaultValue: any = {}) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('JSON parse error:', error);
      return defaultValue;
    }
  }
  return data || defaultValue;
};

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Projects routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Create a new project (this might be handled by upload route, but here for completeness)
router.post('/', [
  authenticateToken,
  body('title').isLength({ min: 1, max: 255 }).trim(),
  body('deadline').optional().isISO8601(),
  body('settings').optional().isObject()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { title, deadline, settings } = req.body;
    const userId = req.user!.userId;

    const defaultSettings = {
      allowDownload: true,
      watermarkPreviews: false,
      autoExpire: false,
      maxCollaborators: 5,
      requireApproval: false,
      ...settings
    };

    // This would typically be handled by the upload route
    // But keeping for API completeness
    res.status(501).json({
      success: false,
      error: {
        message: 'Use upload route to create projects with audio files',
        code: 'USE_UPLOAD_ROUTE'
      }
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create project',
        code: 'CREATE_PROJECT_ERROR'
      }
    });
  }
});

// Get user's projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Get projects where user is creator or collaborator
    const projectsQuery = `
      SELECT DISTINCT 
        p.id,
        p.title,
        p.description,
        p.creator_id,
        p.status,
        p.deadline,
        p.share_link,
        p.settings,
        p.created_at,
        p.updated_at,
        u.username as creator_username,
        u.email as creator_email,
        u.role as creator_role,
        u.subscription_tier as creator_subscription_tier,
        u.profile_image as creator_profile_image,
        u.created_at as creator_created_at,
        u.updated_at as creator_updated_at
      FROM projects p
      JOIN users u ON p.creator_id = u.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.creator_id = $1 OR (pc.user_id = $1 AND pc.status = 'accepted')
      ORDER BY p.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const projectsResult = await pool.query(projectsQuery, [userId, limit, offset]);

    // Get additional data for each project
    const projects = await Promise.all(
      projectsResult.rows.map(async (row) => {
        try {
          // Get collaborators
          const collaboratorsQuery = `
            SELECT 
              pc.id,
              pc.project_id,
              pc.user_id,
              pc.role,
              pc.permissions,
              pc.invited_by,
              pc.invited_at,
              pc.accepted_at,
              pc.status,
              u.username,
              u.email,
              u.role as user_role,
              u.subscription_tier,
              u.profile_image,
              u.created_at as user_created_at,
              u.updated_at as user_updated_at
            FROM project_collaborators pc
            JOIN users u ON pc.user_id = u.id
            WHERE pc.project_id = $1
            ORDER BY pc.invited_at DESC
          `;

          const collaboratorsResult = await pool.query(collaboratorsQuery, [row.id]);

          // Process collaborators with S3 signed URLs
          const collaborators = await Promise.all(
            collaboratorsResult.rows.map(async (collab) => ({
              id: collab.id,
              projectId: collab.project_id,
              userId: collab.user_id,
              user: await S3ImageProcessor.processUserWithProfileImage({
                id: collab.user_id,
                username: collab.username,
                email: collab.email,
                role: collab.user_role,
                subscriptionTier: collab.subscription_tier,
                profileImage: collab.profile_image,
                createdAt: collab.user_created_at,
                updatedAt: collab.user_updated_at
              }),
              role: collab.role,
              permissions: typeof collab.permissions === 'string' ? 
                safeJSONParse(collab.permissions, { canEdit: false, canComment: true }) : collab.permissions,
              invitedBy: collab.invited_by,
              invitedAt: collab.invited_at,
              acceptedAt: collab.accepted_at,
              status: collab.status
            }))
          );

          // Process creator profile image
          const processedCreator = await S3ImageProcessor.processUserWithProfileImage({
            id: row.creator_id,
            username: row.creator_username,
            email: row.creator_email,
            role: row.creator_role,
            subscriptionTier: row.creator_subscription_tier,
            profileImage: row.creator_profile_image,
            createdAt: row.creator_created_at,
            updatedAt: row.creator_updated_at
          });
          
          // Get audio files
          const audioFilesQuery = `
            SELECT * FROM audio_files 
            WHERE project_id = $1 
            ORDER BY uploaded_at DESC
          `;
          
          const audioFilesResult = await pool.query(audioFilesQuery, [row.id]);

          // Parse settings safely
          let settings;
          try {
            settings = typeof row.settings === 'string' ? safeJSONParse(row.settings, { allowDownload: true }) : row.settings;
          } catch (parseError) {
            console.warn(`Failed to parse settings for project ${row.id}:`, parseError);
            settings = {
              allowDownload: true,
              watermarkPreviews: false,
              autoExpire: false,
              maxCollaborators: 5,
              requireApproval: false
            };
          }

          return {
            id: row.id,
            title: row.title,
            description: row.description || '',
            creatorId: row.creator_id,
            creator: processedCreator,
            status: row.status,
            deadline: row.deadline,
            shareLink: row.share_link,
            settings: settings,
            collaborators: collaborators,
            audioFiles: audioFilesResult.rows.map(af => ({
              id: af.id,
              projectId: af.project_id,
              version: af.version,
              filename: af.filename,
              originalFilename: af.original_filename,
              fileUrl: af.file_url,
              duration: af.duration,
              sampleRate: af.sample_rate,
              fileSize: af.file_size,
              mimeType: af.mime_type,
              waveformData: af.waveform_data ? (typeof af.waveform_data === 'string' ? safeJSONParse(af.waveform_data, undefined) : af.waveform_data) : undefined,
              uploadedBy: af.uploaded_by,
              uploadedAt: af.uploaded_at,
              isActive: af.is_active
            })),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        } catch (projectError) {
          console.error(`Error processing project ${row.id}:`, projectError);
          // Return minimal project data if there's an error
          return {
            id: row.id,
            title: row.title,
            description: row.description || '',
            creatorId: row.creator_id,
            creator: {
              id: row.creator_id,
              username: row.creator_username || 'Unknown',
              email: row.creator_email || '',
              role: row.creator_role || 'producer',
              subscriptionTier: row.creator_subscription_tier || 'free',
              profileImage: null,
              createdAt: row.creator_created_at,
              updatedAt: row.creator_updated_at
            },
            status: row.status,
            deadline: row.deadline,
            shareLink: row.share_link,
            settings: {
              allowDownload: true,
              watermarkPreviews: false,
              autoExpire: false,
              maxCollaborators: 5,
              requireApproval: false
            },
            collaborators: [],
            audioFiles: [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        }
      })
    );

    res.json({
      success: true,
      data: projects
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get projects',
        code: 'GET_PROJECTS_ERROR',
        details: process.env.NODE_ENV === 'development' 
            ? (error as CustomError).message 
            : undefined      }
    });
  }
});

// Get project by ID
router.get('/:id', [
  authenticateToken,
  param('id').isUUID()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const projectId = req.params.id;
    const userId = req.user!.userId;

    // Check if user can access this project
    const accessQuery = `
      SELECT 1 FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = $1 AND (
        p.creator_id = $2 OR 
        (pc.user_id = $2 AND pc.status = 'accepted')
      )
      LIMIT 1
    `;

    const accessResult = await pool.query(accessQuery, [projectId, userId]);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied or project not found',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Get full project details
    const projectQuery = `
      SELECT 
        p.*,
        u.id as creator_id,
        u.username as creator_username,
        u.email as creator_email,
        u.role as creator_role,
        u.subscription_tier as creator_subscription_tier,
        u.profile_image as creator_profile_image,
        u.created_at as creator_created_at,
        u.updated_at as creator_updated_at
      FROM projects p
      JOIN users u ON p.creator_id = u.id
      WHERE p.id = $1
    `;

    const projectResult = await pool.query(projectQuery, [projectId]);
    
    // Debug logging to see what we get from database
    if (projectResult.rows.length > 0) {
      console.log('🔍 Raw project row from database:', {
        id: projectResult.rows[0].id,
        title: projectResult.rows[0].title,
        description: projectResult.rows[0].description,
        hasDescriptionField: 'description' in projectResult.rows[0],
        descriptionType: typeof projectResult.rows[0].description
      });
    }

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        }
      });
    }

    const row = projectResult.rows[0];

    // Get collaborators
    const collaboratorsQuery = `
      SELECT 
        pc.*,
        u.username,
        u.email,
        u.role as user_role,
        u.subscription_tier,
        u.profile_image,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at
      FROM project_collaborators pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.project_id = $1
      ORDER BY pc.invited_at DESC
    `;

    const collaboratorsResult = await pool.query(collaboratorsQuery, [projectId]);

    // Process collaborators with S3 signed URLs
    const collaborators = await Promise.all(
      collaboratorsResult.rows.map(async (collab) => ({
        id: collab.id,
        projectId: collab.project_id,
        userId: collab.user_id,
        user: await S3ImageProcessor.processUserWithProfileImage({
          id: collab.user_id,
          username: collab.username,
          email: collab.email,
          role: collab.user_role,
          subscriptionTier: collab.subscription_tier,
          profileImage: collab.profile_image,
          createdAt: collab.user_created_at,
          updatedAt: collab.user_updated_at
        }),
        role: collab.role,
        permissions: typeof collab.permissions === 'string' ? 
          safeJSONParse(collab.permissions, { canEdit: false, canComment: true }) : collab.permissions,
        invitedBy: collab.invited_by,
        invitedAt: collab.invited_at,
        acceptedAt: collab.accepted_at,
        status: collab.status
      }))
    );

    // Process creator profile image
    const processedCreator = await S3ImageProcessor.processUserWithProfileImage({
      id: row.creator_id,
      username: row.creator_username,
      email: row.creator_email,
      role: row.creator_role,
      subscriptionTier: row.creator_subscription_tier,
      profileImage: row.creator_profile_image,
      createdAt: row.creator_created_at,
      updatedAt: row.creator_updated_at
    });

    // Get audio files
    const audioFilesQuery = `
      SELECT * FROM audio_files 
      WHERE project_id = $1 
      ORDER BY uploaded_at DESC
    `;

    const audioFilesResult = await pool.query(audioFilesQuery, [projectId]);

    // Parse settings safely
    let settings;
    try {
      settings = typeof row.settings === 'string' ? safeJSONParse(row.settings, { allowDownload: true }) : row.settings;
    } catch (parseError) {
      console.warn(`Failed to parse settings for project ${projectId}:`, parseError);
      settings = {
        allowDownload: true,
        watermarkPreviews: false,
        autoExpire: false,
        maxCollaborators: 5,
        requireApproval: false
      };
    }

    const project = {
      id: row.id,
      title: row.title,
      description: row.description || '',
      creatorId: row.creator_id,
      creator: processedCreator,
      status: row.status,
      deadline: row.deadline,
      shareLink: row.share_link,
      settings: settings,
      collaborators: collaborators,
      audioFiles: audioFilesResult.rows.map(af => ({
        id: af.id,
        projectId: af.project_id,
        version: af.version,
        filename: af.filename,
        originalFilename: af.original_filename,
        fileUrl: af.file_url,
        duration: af.duration,
        sampleRate: af.sample_rate,
        fileSize: af.file_size,
        mimeType: af.mime_type,
        waveformData: af.waveform_data ? (typeof af.waveform_data === 'string' ? safeJSONParse(af.waveform_data, undefined) : af.waveform_data) : undefined,
        uploadedBy: af.uploaded_by,
        uploadedAt: af.uploaded_at,
        isActive: af.is_active
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    // Debug: Log what we're sending back
    console.log('🚀 Sending project response:', {
      id: project.id,
      title: project.title,
      description: project.description,
      hasDescription: 'description' in project
    });

    res.json({
      success: true,
      data: project
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get project',
        code: 'GET_PROJECT_ERROR',
        details: process.env.NODE_ENV === 'development' 
            ? (error as CustomError).message 
            : undefined      }
    });
  }
});

// Update project
router.put('/:id', [
  authenticateToken,
  param('id').isUUID(),
  body('title').optional().isLength({ min: 1, max: 255 }).trim(),
  body('status').optional().isIn(['active', 'completed', 'archived']),
  body('deadline').optional().isISO8601(),
  body('settings').optional().isObject()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const projectId = req.params.id;
    const userId = req.user!.userId;
    const updateData = req.body;

    // Check if user can edit this project (creator or admin collaborator)
    const permissionQuery = `
      SELECT 
        p.creator_id,
        pc.role as collaborator_role
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1
    `;

    const permissionResult = await pool.query(permissionQuery, [projectId, userId]);

    if (permissionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        }
      });
    }

    const { creator_id, collaborator_role } = permissionResult.rows[0];
    const isCreator = creator_id === userId;
    const isAdmin = collaborator_role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Permission denied - only project creator or admin can edit',
          code: 'PERMISSION_DENIED'
        }
      });
    }

    // Build update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'settings') {
          fields.push(`settings = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          const dbField = key === 'deadline' ? 'deadline' : key.replace(/([A-Z])/g, '_$1').toLowerCase();
          fields.push(`${dbField} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No fields to update',
          code: 'NO_UPDATE_FIELDS'
        }
      });
    }

    // Add updated_at
    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    paramCount++;

    // Add project ID for WHERE clause
    values.push(projectId);

    const updateQuery = `
      UPDATE projects 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, values);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        }
      });
    }

    // Return updated project (reuse the GET logic)
    const updatedProjectResponse = await fetch(`${req.protocol}://${req.get('host')}/api/projects/${projectId}`, {
      headers: {
        'Authorization': req.headers.authorization!
      }
    });

    if (updatedProjectResponse.ok) {
      const updatedProject = await updatedProjectResponse.json();
      res.json(updatedProject);
    } else {
      // Fallback: return basic updated data
      res.json({
        success: true,
        data: updateResult.rows[0]
      });
    }

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update project',
        code: 'UPDATE_PROJECT_ERROR'
      }
    });
  }
});

// Delete project
router.delete('/:id', [
  authenticateToken,
  param('id').isUUID()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const projectId = req.params.id;
    const userId = req.user!.userId;

    // Check if user is the creator (only creators can delete)
    const projectQuery = `
      SELECT creator_id, title FROM projects WHERE id = $1
    `;

    const projectResult = await pool.query(projectQuery, [projectId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        }
      });
    }

    if (projectResult.rows[0].creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Only project creator can delete project',
          code: 'PERMISSION_DENIED'
        }
      });
    }

    // Delete project (cascading deletes will handle related records)
    const deleteQuery = `DELETE FROM projects WHERE id = $1`;
    const deleteResult = await pool.query(deleteQuery, [projectId]);

    if (deleteResult.rowCount === 0) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete project',
          code: 'DELETE_PROJECT_ERROR'
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Project deleted successfully',
        projectId: projectId
      }
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete project',
        code: 'DELETE_PROJECT_ERROR'
      }
    });
  }
});

// Update project description
router.put('/:id/description', [
  authenticateToken,
  param('id').isUUID(),
  body('description').optional().isString().trim()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const projectId = req.params.id;
    const userId = req.user!.userId;
    const { description } = req.body;

    // Check if user is the creator of the project
    const projectQuery = `
      SELECT creator_id, title FROM projects WHERE id = $1
    `;

    const projectResult = await pool.query(projectQuery, [projectId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        }
      });
    }

    const project = projectResult.rows[0];

    if (project.creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Only project creator can edit description',
          code: 'PERMISSION_DENIED'
        }
      });
    }

    // Update the project description
    const updateQuery = `
      UPDATE projects 
      SET description = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING description, updated_at
    `;

    const updateResult = await pool.query(updateQuery, [description || '', projectId]);

    res.json({
      success: true,
      data: {
        description: updateResult.rows[0].description,
        updatedAt: updateResult.rows[0].updated_at,
        message: 'Description updated successfully'
      }
    });

  } catch (error) {
    console.error('Update description error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update description',
        code: 'UPDATE_DESCRIPTION_ERROR'
      }
    });
  }
});

export default router;