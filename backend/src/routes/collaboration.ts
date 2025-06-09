// backend/src/routes/collaboration.ts
import express, { Request, Response } from 'express';
import { body, validationResult, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = express.Router();

// Generate invite link for project
router.post('/projects/:projectId/invite-link', [
  authenticateToken,
  param('projectId').isUUID(),
  body('role').isIn(['producer', 'artist', 'viewer', 'admin']),
  body('permissions').isObject(),
  body('expiresIn').optional().isInt({ min: 1, max: 30 }) // days
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { projectId } = req.params;
    const { role, permissions, expiresIn = 7 } = req.body;
    const userId = req.user!.userId;

    // Verify user owns the project or is admin
    const projectCheck = await pool.query(`
      SELECT p.creator_id, pc.role as collaborator_role
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1
    `, [projectId, userId]);

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', code: 'PROJECT_NOT_FOUND' }
      });
    }

    const { creator_id, collaborator_role } = projectCheck.rows[0];
    const isOwner = creator_id === userId;
    const isAdmin = collaborator_role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Generate unique invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    // Store invite in database
    const inviteId = uuidv4();
    await pool.query(`
      INSERT INTO project_invites (
        id, project_id, invited_by, invite_token, role, permissions, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [inviteId, projectId, userId, inviteToken, role, JSON.stringify(permissions), expiresAt]);

    const inviteLink = `${process.env.FRONTEND_URL}/join/${inviteToken}`;

    res.json({
      success: true,
      data: {
        inviteLink,
        inviteToken,
        expiresAt,
        role,
        permissions
      }
    });

  } catch (error) {
    console.error('Generate invite link error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate invite link', code: 'INVITE_LINK_ERROR' }
    });
  }
});

// Send email invitation
router.post('/projects/:projectId/invite', [
  authenticateToken,
  param('projectId').isUUID(),
  body('email').isEmail(),
  body('role').isIn(['producer', 'artist', 'viewer', 'admin']),
  body('permissions').isObject(),
  body('message').optional().isLength({ max: 500 })
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { projectId } = req.params;
    const { email, role, permissions, message = '' } = req.body;
    const userId = req.user!.userId;

    // Verify permissions (same as above)
    const projectCheck = await pool.query(`
      SELECT p.creator_id, p.title, pc.role as collaborator_role,
             u.username as creator_username
      FROM projects p
      JOIN users u ON p.creator_id = u.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1
    `, [projectId, userId]);

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', code: 'PROJECT_NOT_FOUND' }
      });
    }

    const { creator_id, title, collaborator_role, creator_username } = projectCheck.rows[0];
    const isOwner = creator_id === userId;
    const isAdmin = collaborator_role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Check if user already exists
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (userCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'User not found. They need to register first.', code: 'USER_NOT_FOUND' }
      });
    }

    const invitedUserId = userCheck.rows[0].id;

    // Check if already collaborating
    const existingCollab = await pool.query(`
      SELECT id FROM project_collaborators 
      WHERE project_id = $1 AND user_id = $2
    `, [projectId, invitedUserId]);

    if (existingCollab.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'User is already a collaborator', code: 'ALREADY_COLLABORATOR' }
      });
    }

    // Create collaboration invitation
    const collaborationId = uuidv4();
    await pool.query(`
      INSERT INTO project_collaborators (
        id, project_id, user_id, role, permissions, invited_by, 
        invited_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'pending')
    `, [collaborationId, projectId, invitedUserId, role, JSON.stringify(permissions), userId]);

    // Create notification
    const notificationId = uuidv4();
    await pool.query(`
      INSERT INTO notifications (
        id, user_id, project_id, type, title, message, data, created_at
      ) VALUES ($1, $2, $3, 'project_shared', $4, $5, $6, NOW())
    `, [
      notificationId,
      invitedUserId,
      projectId,
      `Invited to "${title}"`,
      `${creator_username} invited you to collaborate on "${title}" as ${role}`,
      JSON.stringify({ projectId, role, invitedBy: userId, customMessage: message })
    ]);

    // TODO: Send email notification here
    // await sendEmailInvitation({ email, projectTitle: title, inviterName: creator_username, role, message });

    res.json({
      success: true,
      data: {
        message: 'Invitation sent successfully',
        collaborationId,
        role,
        permissions
      }
    });

  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to send invitation', code: 'SEND_INVITE_ERROR' }
    });
  }
});

// Accept invite via token (public route)
router.post('/join/:token', [
  authenticateToken,
  param('token').isLength({ min: 64, max: 64 })
], async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = req.user!.userId;

    // Find valid invite
    const inviteQuery = await pool.query(`
      SELECT pi.*, p.title, p.creator_id, u.username as inviter_name
      FROM project_invites pi
      JOIN projects p ON pi.project_id = p.id
      JOIN users u ON pi.invited_by = u.id
      WHERE pi.invite_token = $1 AND pi.expires_at > NOW() AND pi.used_at IS NULL
    `, [token]);

    if (inviteQuery.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired invite link', code: 'INVALID_INVITE' }
      });
    }

    const invite = inviteQuery.rows[0];

    // Check if already collaborating
    const existingCollab = await pool.query(`
      SELECT id FROM project_collaborators 
      WHERE project_id = $1 AND user_id = $2
    `, [invite.project_id, userId]);

    if (existingCollab.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'You are already a collaborator on this project', code: 'ALREADY_COLLABORATOR' }
      });
    }

    // Create collaboration and mark invite as used
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Add collaborator
      const collaborationId = uuidv4();
      await client.query(`
        INSERT INTO project_collaborators (
          id, project_id, user_id, role, permissions, invited_by, 
          invited_at, accepted_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'accepted')
      `, [
        collaborationId, 
        invite.project_id, 
        userId, 
        invite.role, 
        invite.permissions, 
        invite.invited_by,
        invite.created_at
      ]);

      // Mark invite as used
      await client.query(`
        UPDATE project_invites SET used_at = NOW(), used_by = $1 WHERE id = $2
      `, [userId, invite.id]);

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          message: `Successfully joined "${invite.title}" as ${invite.role}`,
          projectId: invite.project_id,
          role: invite.role,
          permissions: JSON.parse(invite.permissions)
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Join project error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to join project', code: 'JOIN_PROJECT_ERROR' }
    });
  }
});

// Share project link
router.post('/:projectId/share', [
  authenticateToken
], async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    // Generate a unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');

    // Store the share token with project reference
    await pool.query(`
      INSERT INTO project_shares (
        project_id,
        share_token,
        created_by,
        created_at,
        expires_at
      ) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '30 days')
    `, [projectId, shareToken, userId]);

    res.json({
      success: true,
      data: {
        shareToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

  } catch (error) {
    console.error('Generate share link error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate share link' }
    });
  }
});

// Generate a viewer link for a project
router.post('/projects/:projectId/viewer-link', [
  authenticateToken,
  param('projectId').isUUID(),
], async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    // Generate a viewer token
    const viewerToken = crypto.randomBytes(32).toString('hex');
    
    // Store the viewer token with project reference
    await pool.query(`
      INSERT INTO project_viewer_links (
        project_id,
        viewer_token,
        created_by,
        created_at,
        expires_at
      ) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '30 days')
    `, [projectId, viewerToken, userId]);

    res.json({
      success: true,
      data: {
        viewerToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

  } catch (error) {
    console.error('Generate viewer link error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate viewer link' }
    });
  }
});

// Add this route to fetch project data for viewers
router.get('/projects/viewer/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const project = await pool.query(`
      SELECT p.id, p.title, pv.viewer_token, 
            af.id as file_id, af.filename, af.version, af.file_url, af.duration,
            array_agg(DISTINCT jsonb_build_object(
              'id', a.id,
              'text', a.text,
              'timestamp', a.timestamp,
              'annotationType', a.annotation_type,
              'status', a.status,
              'createdAt', a.created_at,
              'priority', a.priority,
              'parentId', a.parent_id,
              'voiceNoteUrl', a.voice_note_url,
              'user', jsonb_build_object(
                'id', u.id,
                'username', u.username,
                'email', u.email
              )
            )) FILTER (WHERE a.id IS NOT NULL) as annotations
      FROM projects p
      JOIN project_viewer_links pv ON p.id = pv.project_id
      JOIN audio_files af ON p.id = af.project_id AND af.is_active = true
      LEFT JOIN annotations a ON af.id = a.audio_file_id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE pv.viewer_token = $1 AND pv.expires_at > NOW()
      GROUP BY p.id, pv.viewer_token, af.id, af.filename, af.version, af.file_url, af.duration, p.title
    `, [token]);

    if (project.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invalid or expired view link' }
      });
    }

    // Update last accessed timestamp
    await pool.query(`
      UPDATE project_viewer_links 
      SET last_accessed_at = NOW() 
      WHERE viewer_token = $1
    `, [token]);

    const row = project.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        title: row.title,
        currentAudioFile: {
          id: row.file_id,
          filename: row.filename,
          version: row.version,
          fileUrl: row.file_url,  // This was missing!
          duration: row.duration
        },
        annotations: row.annotations || []
      }
    });

  } catch (error) {
    console.error('Get viewer project error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get project data' }
    });
  }
});


// Get project collaborators
router.get('/projects/:projectId/collaborators', [
  authenticateToken,
  param('projectId').isUUID()
], async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT 1 FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = $1 AND (p.creator_id = $2 OR (pc.user_id = $2 AND pc.status = 'accepted'))
    `, [projectId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    // Get collaborators
    const collaborators = await pool.query(`
      SELECT pc.*, u.username, u.email, u.role as user_role, 
             u.profile_image, u.created_at as user_created_at,
             inviter.username as inviter_name
      FROM project_collaborators pc
      JOIN users u ON pc.user_id = u.id
      LEFT JOIN users inviter ON pc.invited_by = inviter.id
      WHERE pc.project_id = $1
      ORDER BY pc.accepted_at DESC, pc.invited_at DESC
    `, [projectId]);

    res.json({
      success: true,
      data: collaborators.rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        user: {
          id: row.user_id,
          username: row.username,
          email: row.email,
          role: row.user_role,
          profileImage: row.profile_image,
          createdAt: row.user_created_at
        },
        role: row.role,
        invitedBy: row.invited_by,
        inviterName: row.inviter_name,
        invitedAt: row.invited_at,
        acceptedAt: row.accepted_at,
        status: row.status
      }))
    });

  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get collaborators', code: 'GET_COLLABORATORS_ERROR' }
    });
  }
});

router.get('/projects/:projectId/collaborators/:collaboratorId', [
  authenticateToken,
  param('projectId').isUUID(),
  param('collaboratorId').isUUID()
], async (req: Request, res: Response) => {
  try {
    const { projectId, collaboratorId } = req.params;
    const userId = req.user!.userId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT 1 FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = $1 AND (p.creator_id = $2 OR (pc.user_id = $2 AND pc.status = 'accepted'))
    `, [projectId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    // Get specific collaborator
    const collaborator = await pool.query(`
      SELECT pc.*, u.username, u.email, u.role as user_role, 
             u.profile_image, u.created_at as user_created_at,
             inviter.username as inviter_name
      FROM project_collaborators pc
      JOIN users u ON pc.user_id = u.id
      LEFT JOIN users inviter ON pc.invited_by = inviter.id
      WHERE pc.project_id = $1 AND pc.id = $2
    `, [projectId, collaboratorId]);

    if (collaborator.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Collaborator not found', code: 'COLLABORATOR_NOT_FOUND' }
      });
    }

    const row = collaborator.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        user: {
          id: row.user_id,
          username: row.username,
          email: row.email,
          role: row.user_role,
          profileImage: row.profile_image,
          createdAt: row.user_created_at
        },
        role: row.role,
        permissions: JSON.parse(row.permissions),
        invitedBy: row.invited_by,
        inviterName: row.inviter_name,
        invitedAt: row.invited_at,
        acceptedAt: row.accepted_at,
        status: row.status
      }
    });

  } catch (error) {
    console.error('Get collaborator error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get collaborator', code: 'GET_COLLABORATOR_ERROR' }
    });
  }
});

// Remove collaborator
router.delete('/projects/:projectId/collaborators/:collaboratorId', [
  authenticateToken,
  param('projectId').isUUID(),
  param('collaboratorId').isUUID()
], async (req: Request, res: Response) => {
  try {
    const { projectId, collaboratorId } = req.params;
    const userId = req.user!.userId;

    // Verify user is owner or admin
    const permissionCheck = await pool.query(`
      SELECT p.creator_id, pc.role as user_role, target_pc.user_id as target_user_id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      LEFT JOIN project_collaborators target_pc ON target_pc.id = $3
      WHERE p.id = $1
    `, [projectId, userId, collaboratorId]);

    if (permissionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project or collaborator not found', code: 'NOT_FOUND' }
      });
    }

    const { creator_id, user_role, target_user_id } = permissionCheck.rows[0];
    const isOwner = creator_id === userId;
    const isAdmin = user_role === 'admin';
    const isRemovingSelf = target_user_id === userId;

    if (!isOwner && !isAdmin && !isRemovingSelf) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Remove collaborator
    const result = await pool.query(`
      DELETE FROM project_collaborators WHERE id = $1
    `, [collaboratorId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Collaborator not found', code: 'COLLABORATOR_NOT_FOUND' }
      });
    }

    res.json({
      success: true,
      data: { message: 'Collaborator removed successfully' }
    });

  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to remove collaborator', code: 'REMOVE_COLLABORATOR_ERROR' }
    });
  }
});

// Update collaborator role/permissions
router.put('/projects/:projectId/collaborators/:collaboratorId', [
  authenticateToken,
  param('projectId').isUUID(),
  param('collaboratorId').isUUID(),
  body('role').optional().isIn(['producer', 'artist', 'viewer', 'admin']),
  body('permissions').optional().isObject()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { projectId, collaboratorId } = req.params;
    const { role, permissions } = req.body;
    const userId = req.user!.userId;

    // Verify user is owner or admin
    const permissionCheck = await pool.query(`
      SELECT p.creator_id, pc.role as user_role
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1
    `, [projectId, userId]);

    if (permissionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', code: 'PROJECT_NOT_FOUND' }
      });
    }

    const { creator_id, user_role } = permissionCheck.rows[0];
    const isOwner = creator_id === userId;
    const isAdmin = user_role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (role) {
      updates.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (permissions) {
      updates.push(`permissions = $${paramCount}`);
      values.push(JSON.stringify(permissions));
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No updates provided', code: 'NO_UPDATES' }
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(collaboratorId);

    const query = `
      UPDATE project_collaborators 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Collaborator not found', code: 'COLLABORATOR_NOT_FOUND' }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Collaborator updated successfully',
        collaborator: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Update collaborator error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update collaborator', code: 'UPDATE_COLLABORATOR_ERROR' }
    });
  }
});

export default router;