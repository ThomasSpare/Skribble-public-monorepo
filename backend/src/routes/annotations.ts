// backend/src/routes/annotations.ts
import express, { Request, Response } from 'express';
import { body, validationResult, param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { AnnotationModel } from '../models/Annotation';
import { pool } from '../config/database';

const router = express.Router();
interface CustomError extends Error {
  message: string;
}

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Annotation routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Create a new annotation
router.post('/', [ // filepath: backend/src/routes/annotations.ts
  authenticateToken,
  body('audioFileId').isUUID().withMessage('Valid audio file ID is required'),
  body('timestamp').isFloat({ min: 0 }).withMessage('Timestamp must be a positive number'),
  body('text').isLength({ min: 1, max: 1000 }).trim().withMessage('Text must be 1-1000 characters'),
  body('annotationType').optional().isIn(['comment', 'marker', 'voice', 'section', 'issue', 'approval']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('parentId').optional().isUUID(),
  body('mentions').optional().isArray()
], async (req: Request, res: Response) => {
  console.log('=== ANNOTATION POST ROUTE HIT ===');
  console.log('Request body:', req.body);
  console.log('User from token:', req.user);
  console.log('Headers:', req.headers);

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        }
      });
    }

    console.log('✅ Annotation validation passed, creating...');

    // Extract data from the request body
    const { audioFileId, timestamp, text, annotationType, priority, parentId, mentions } = req.body;
    const userId = req.user!.userId;

    // Create the annotation data object
    const annotationData = {
      audioFileId,
      userId,
      timestamp,
      text,
      annotationType,
      priority,
      parentId,
      mentions
    };

    // Call the AnnotationModel.create method to save the annotation
    const newAnnotation = await AnnotationModel.create(annotationData);

    // Send the newly created annotation in the response
    res.status(201).json({
      success: true,
      data: newAnnotation
    });

  } catch (error) {
    console.error('❌ Annotation creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create annotation',
        code: 'CREATE_ANNOTATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? (error as CustomError).message : undefined
      }
    });
  }
});

// Get annotations for an audio file
router.get('/audio/:audioFileId', [
  authenticateToken,
  param('audioFileId').isUUID()
], async (req: Request, res: Response) => {
  console.log('=== GET ANNOTATIONS ROUTE HIT ===');
  console.log('Audio File ID:', req.params.audioFileId);
  console.log('Query params:', req.query);
  console.log('User:', req.user);

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

    const { audioFileId } = req.params;
    const userId = req.user!.userId;
    const {
      status,
      priority,
      type,
      userId: filterUserId,
      timeStart,
      timeEnd
    } = req.query;

    // Verify user has access to this audio file
    const accessCheck = await pool.query(`
      SELECT af.id, af.project_id, p.creator_id
      FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE af.id = $1 AND (p.creator_id = $2 OR (pc.user_id = $2 AND pc.status = 'accepted'))
    `, [audioFileId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied or audio file not found',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Build filters
    const filters: any = {};
    
    if (status) {
      filters.status = Array.isArray(status) ? status as string[] : [status as string];
    }
    
    if (priority) {
      filters.priority = Array.isArray(priority) ? priority as string[] : [priority as string];
    }
    
    if (type) {
      filters.type = Array.isArray(type) ? type as string[] : [type as string];
    }
    
    if (filterUserId) {
      filters.userId = filterUserId as string;
    }
    
    if (timeStart && timeEnd) {
      filters.timeRange = {
        start: parseFloat(timeStart as string),
        end: parseFloat(timeEnd as string)
      };
    }

    const annotations = Object.keys(filters).length > 0
      ? await AnnotationModel.findWithFilters(audioFileId, filters)
      : await AnnotationModel.findByAudioFileId(audioFileId);

    console.log(`Found ${annotations.length} annotations`);

    res.json({
      success: true,
      data: annotations
    });
  } catch (error) {
    console.error('Get annotations error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get annotations',
        code: 'GET_ANNOTATIONS_ERROR',
        details: process.env.NODE_ENV === 'development' ? (error as CustomError).message : undefined
      }
    });
  }
});

// Get annotation by ID
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

    const { id } = req.params;
    const userId = req.user!.userId;

    const annotation = await AnnotationModel.findById(id);
    if (!annotation) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Annotation not found',
          code: 'ANNOTATION_NOT_FOUND'
        }
      });
    }

    // Verify user has access to this annotation's project
    const accessCheck = await pool.query(`
      SELECT af.id FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE af.id = $1 AND (p.creator_id = $2 OR (pc.user_id = $2 AND pc.status = 'accepted'))
    `, [annotation.audioFileId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        }
      });
    }

    res.json({
      success: true,
      data: annotation
    });
  } catch (error) {
    console.error('Get annotation error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get annotation',
        code: 'GET_ANNOTATION_ERROR'
      }
    });
  }
});

// Update annotation
router.put('/:id', [
  authenticateToken,
  param('id').isUUID(),
  body('text').optional().isLength({ min: 1, max: 1000 }).trim(),
  body('status').optional().isIn(['pending', 'in-progress', 'resolved', 'approved']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('mentions').optional().isArray()
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

    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user!.userId;

    // Check if annotation exists and get access info
    const existingAnnotation = await AnnotationModel.findById(id);
    if (!existingAnnotation) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Annotation not found',
          code: 'ANNOTATION_NOT_FOUND'
        }
      });
    }

    // Verify user has access to this annotation's project
    const accessCheck = await pool.query(`
      SELECT af.id, p.creator_id FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE af.id = $1 AND (p.creator_id = $2 OR (pc.user_id = $2 AND pc.status = 'accepted'))
    `, [existingAnnotation.audioFileId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Only annotation owner can edit text, but anyone with access can update status
    if (updateData.text && existingAnnotation.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Only annotation owner can edit text',
          code: 'PERMISSION_DENIED'
        }
      });
    }

    const annotation = await AnnotationModel.update(id, updateData);

    res.json({
      success: true,
      data: annotation
    });
  } catch (error) {
    console.error('Update annotation error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update annotation',
        code: 'UPDATE_ANNOTATION_ERROR'
      }
    });
  }
});

// Delete annotation
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

    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if annotation exists and user owns it
    const annotation = await AnnotationModel.findById(id);
    if (!annotation) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Annotation not found',
          code: 'ANNOTATION_NOT_FOUND'
        }
      });
    }

    if (annotation.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Only annotation owner can delete annotation',
          code: 'PERMISSION_DENIED'
        }
      });
    }

    const deleted = await AnnotationModel.delete(id);
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete annotation',
          code: 'DELETE_ANNOTATION_ERROR'
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Annotation deleted successfully'
      }
    });
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete annotation',
        code: 'DELETE_ANNOTATION_ERROR'
      }
    });
  }
});

// Get replies to an annotation
router.get('/:id/replies', [
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

    const { id } = req.params;
    const userId = req.user!.userId;

    // Verify parent annotation exists and user has access
    const parentAnnotation = await AnnotationModel.findById(id);
    if (!parentAnnotation) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Parent annotation not found',
          code: 'ANNOTATION_NOT_FOUND'
        }
      });
    }

    // Verify access to the project
    const accessCheck = await pool.query(`
      SELECT af.id FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE af.id = $1 AND (p.creator_id = $2 OR (pc.user_id = $2 AND pc.status = 'accepted'))
    `, [parentAnnotation.audioFileId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const replies = await AnnotationModel.findReplies(id);

    res.json({
      success: true,
      data: replies
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get replies',
        code: 'GET_REPLIES_ERROR'
      }
    });
  }
});

// Resolve annotation
router.patch('/:id/resolve', [
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

    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if annotation exists and user has access
    const existingAnnotation = await AnnotationModel.findById(id);
    if (!existingAnnotation) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Annotation not found',
          code: 'ANNOTATION_NOT_FOUND'
        }
      });
    }

    // Verify access to the project
    const accessCheck = await pool.query(`
      SELECT af.id FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE af.id = $1 AND (p.creator_id = $2 OR (pc.user_id = $2 AND pc.status = 'accepted'))
    `, [existingAnnotation.audioFileId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const annotation = await AnnotationModel.resolve(id);
    if (!annotation) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Annotation not found',
          code: 'ANNOTATION_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: annotation
    });
  } catch (error) {
    console.error('Resolve annotation error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to resolve annotation',
        code: 'RESOLVE_ANNOTATION_ERROR'
      }
    });
  }
});

// Get project annotation statistics
router.get('/project/:projectId/stats', [
  authenticateToken,
  param('projectId').isUUID()
], async (req: Request, res: Response) => {{
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

    const { projectId } = req.params;
    const userId = req.user!.userId;

    // Verify user has access to this project
    const accessCheck = await pool.query(`
      SELECT p.id FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1 AND (p.creator_id = $2 OR (pc.user_id = $2 AND pc.status = 'accepted'))
    `, [projectId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied or project not found',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const stats = await AnnotationModel.getProjectStats(projectId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get project statistics',
        code: 'GET_PROJECT_STATS_ERROR'
      }
    });
  }
}});

// Get user mentions
router.get('/mentions/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const mentions = await AnnotationModel.findMentions(userId);

    res.json({
      success: true,
      data: mentions
    });
  } catch (error) {
    console.error('Get mentions error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get mentions',
        code: 'GET_MENTIONS_ERROR'
      }
    });
  }
});

export default router;