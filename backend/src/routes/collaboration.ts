// backend/src/routes/collaboration.ts - COMPLETE VERSION
import express, { Request, Response } from 'express';
import { body, validationResult, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { S3ImageProcessor } from '../utils/s3ImageProcessor';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// JWT payload interface
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  subscriptionTier: string;
}

// Utility function to safely parse JSON
const safeJSONParse = (data: any) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('JSON parse error:', error, 'Data:', data);
      return {
        canEdit: false,
        canComment: true,
        canExport: false,
        canInvite: false,
        canManageProject: false
      };
    }
  }
  return data || {
    canEdit: false,
    canComment: true,
    canExport: false,
    canInvite: false,
    canManageProject: false
  };
};

// Utility function to safely stringify JSON for database
const safeJSONStringify = (data: any) => {
  if (typeof data === 'string') {
    return data; // Already a string
  }
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error('JSON stringify error:', error);
    return JSON.stringify({
      canEdit: false,
      canComment: true,
      canExport: false,
      canInvite: false,
      canManageProject: false
    });
  }
};

// Get invite info (public route - no auth required)
router.get('/invite-info/:token', [
  param('token').isLength({ min: 64, max: 64 })
], async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    console.log(`📧 Getting invite info for token: ${token}`);

    // Find valid invite with project and creator info
    const inviteQuery = await pool.query(`
      SELECT 
        pi.role, pi.permissions, pi.expires_at, pi.creates_guest_account,
        p.title as project_title, p.id as project_id,
        u.username as creator_name, u.email as creator_email
      FROM project_invites pi
      JOIN projects p ON pi.project_id = p.id
      JOIN users u ON pi.invited_by = u.id
      WHERE pi.invite_token = $1 AND pi.expires_at > NOW() AND pi.used_at IS NULL
    `, [token]);

    if (inviteQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invalid or expired invite link', code: 'INVALID_INVITE' }
      });
    }

    const invite = inviteQuery.rows[0];

    res.json({
      success: true,
      data: {
        projectTitle: invite.project_title,
        projectId: invite.project_id,
        creatorName: invite.creator_name,
        role: invite.role,
        expiresAt: invite.expires_at,
        allowsGuestAccess: invite.creates_guest_account,
        isValid: true
      }
    });

  } catch (error) {
    console.error('Get invite info error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get invite information', code: 'INVITE_INFO_ERROR' }
    });
  }
});

// Guest join - creates account and joins project in one step
router.post('/guest-join', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).trim(),
  body('inviteToken').isLength({ min: 64, max: 64 })
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { email, username, inviteToken } = req.body;

    console.log(`👤 Creating guest account for: ${email}, token: ${inviteToken}`);

    // Find valid invite
    const inviteQuery = await pool.query(`
      SELECT pi.*, p.title, p.creator_id, u.username as inviter_name
      FROM project_invites pi
      JOIN projects p ON pi.project_id = p.id
      JOIN users u ON pi.invited_by = u.id
      WHERE pi.invite_token = $1 AND pi.expires_at > NOW() AND pi.used_at IS NULL
    `, [inviteToken]);

    if (inviteQuery.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired invite link', code: 'INVALID_INVITE' }
      });
    }

    const invite = inviteQuery.rows[0];

    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id, subscription_tier, subscription_status FROM users WHERE email = $1',
      [email]
    );

    let userId: string;
    let isNewUser = false;

    if (existingUser.rows.length > 0) {
      // User exists, use existing account
      userId = existingUser.rows[0].id;
      console.log(`✅ Using existing user: ${userId}`);
      
      // Check if already collaborating on THIS project
      const existingCollab = await pool.query(`
        SELECT id FROM project_collaborators 
        WHERE project_id = $1 AND user_id = $2
      `, [invite.project_id, userId]);

      if (existingCollab.rows.length > 0) {
        console.log(`⚠️ User ${userId} already collaborator on project ${invite.project_id}`);
        
        // Generate token for existing user and redirect them
        const payload: JWTPayload = {
          userId: String(userId),
          email: String(email),
          role: 'artist',
          subscriptionTier: 'indie'
        };

        const token = jwt.sign(
          payload,
          JWT_SECRET,
          { 
            expiresIn: '30d',
            issuer: 'skribble-app',
            audience: 'skribble-users'
          }
        );

        return res.json({
          success: true,
          data: {
            message: `Welcome back! You're already collaborating on "${invite.title}"`,
            projectId: invite.project_id,
            role: invite.role,
            permissions: safeJSONParse(invite.permissions),
            guestUser: {
              id: userId,
              email: email,
              username: username,
              temporaryAccess: true,
              alreadyMember: true
            },
            token: token,
            projectInfo: {
              title: invite.title,
              creatorName: invite.inviter_name
            },
            isNewUser: false
          }
        });
      }
      
      // If user has pending/free status, upgrade to trial
      const user = existingUser.rows[0];
      if (user.subscription_status === 'pending' || user.subscription_tier === 'free') {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        
        await pool.query(`
          UPDATE users 
          SET subscription_tier = 'indie', 
              subscription_status = 'active',
              trial_end_date = $1,
              updated_at = NOW()
          WHERE id = $2
        `, [trialEndDate, userId]);
        
        console.log(`🎁 Granted 30-day trial to existing user: ${userId}`);
      }
    } else {
      // Check if username is taken
      const existingUsername = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      
      if (existingUsername.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Username already taken', code: 'USERNAME_TAKEN' }
        });
      }

      // Create new guest user with 30-day trial
      userId = uuidv4();
      isNewUser = true;
      
      // Generate a temporary password (user can change it later)
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);
      
      await pool.query(`
        INSERT INTO users (
          id, email, username, password, role, subscription_tier, 
          subscription_status, trial_end_date, is_guest, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'artist', 'indie', 'active', $5, true, NOW(), NOW())
      `, [userId, email, username, hashedPassword, trialEndDate]);
      
      console.log(`🎉 Created new guest user: ${userId} with 30-day trial`);
    }

    // At this point, we know the user doesn't exist as a collaborator
    // (either new user or existing user not on this project)

    // Add user as collaborator and mark invite as used
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
        safeJSONStringify(invite.permissions),
        invite.invited_by,
        invite.created_at
      ]);

      // Mark invite as used
      await client.query(`
        UPDATE project_invites SET used_at = NOW(), used_by = $1 WHERE id = $2
      `, [userId, invite.id]);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Generate JWT token for the guest user
    const payload: JWTPayload = {
      userId: String(userId),
      email: String(email),
      role: 'artist',
      subscriptionTier: 'indie'
    };

    const token = jwt.sign(
      payload,
      JWT_SECRET,
      { 
        expiresIn: '30d', // Long-lived token for guest trial
        issuer: 'skribble-app',
        audience: 'skribble-users'
      }
    );

    console.log(`✅ Guest user ${userId} successfully joined project ${invite.project_id}`);

    res.json({
      success: true,
      data: {
        message: `Successfully joined "${invite.title}" as ${invite.role}`,
        projectId: invite.project_id,
        role: invite.role,
        permissions: safeJSONParse(invite.permissions),
        guestUser: {
          id: userId,
          email: email,
          username: username,
          temporaryAccess: true,
          trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        token: token,
        projectInfo: {
          title: invite.title,
          creatorName: invite.inviter_name
        },
        isNewUser: isNewUser
      }
    });

  } catch (error) {
    console.error('Guest join error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create guest account and join project', code: 'GUEST_JOIN_ERROR' }
    });
  }
});

// Generate invite link with guest account option
router.post('/projects/:projectId/invite-link', [
  authenticateToken,
  param('projectId').isUUID(),
  body('role').isIn(['producer', 'artist', 'viewer', 'admin']),
  body('permissions').isObject(),
  body('allowGuestAccess').optional().isBoolean(),
  body('expiresIn').optional().isInt({ min: 1, max: 30 })
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
    const { role, permissions, allowGuestAccess = true, expiresIn = 7 } = req.body;
    const userId = req.user!.userId;

    // Verify user owns the project or is admin
    const projectCheck = await pool.query(`
      SELECT p.creator_id, pc.role as collaborator_role, p.title
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
        id, project_id, invited_by, invite_token, role, permissions, 
        expires_at, creates_guest_account, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [inviteId, projectId, userId, inviteToken, role, JSON.stringify(permissions), expiresAt, allowGuestAccess]);

    const inviteLink = `${process.env.FRONTEND_URL}/join/${inviteToken}`;

    console.log(`✅ Generated invite link for project ${projectId}: ${inviteLink}`);

    res.json({
      success: true,
      data: {
        inviteLink,
        inviteToken,
        expiresAt,
        role,
        permissions,
        allowsGuestAccess: allowGuestAccess
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

// Enhanced authentication for existing users joining via invite
const authenticateTokenWithGuestSupport = async (req: any, res: any, next: any) => {
  try {
    // Check if this is a guest invite (no subscription check needed)
    const isGuestInvite = req.headers['x-guest-invite'] === 'true';
    
    // First run normal authentication
    await new Promise((resolve, reject) => {
      authenticateToken(req, res, (err: any) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    // If user is authenticated and this is a guest invite, 
    // ensure they get trial access
    if (isGuestInvite && req.user) {
      const { userId } = req.user;
      
      // Check current subscription status
      const userQuery = await pool.query(
        'SELECT subscription_tier, subscription_status FROM users WHERE id = $1',
        [userId]
      );
      
      if (userQuery.rows.length > 0) {
        const user = userQuery.rows[0];
        
        // If user has pending status or free tier, grant 30-day trial for guest collaboration
        if (user.subscription_status === 'pending' || user.subscription_tier === 'free') {
          const trialEndDate = new Date();
          trialEndDate.setDate(trialEndDate.getDate() + 30);
          
          await pool.query(`
            UPDATE users 
            SET subscription_tier = 'indie', 
                subscription_status = 'trialing',
                trial_end_date = $1,
                updated_at = NOW()
            WHERE id = $2
          `, [trialEndDate, userId]);
          
          console.log(`✅ Granted 30-day trial to guest artist: ${userId}`);
        }
      }
    }

    next();
  } catch (error) {
    console.error('Authentication with guest support error:', error);
    res.status(401).json({
      success: false,
      error: { message: 'Authentication failed', code: 'AUTH_FAILED' }
    });
  }
};

// Join project via invite (for existing users with auth tokens)
router.post('/join/:token', [
  authenticateTokenWithGuestSupport,
  param('token').isLength({ min: 64, max: 64 })
], async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = req.user!.userId;
    const isGuestInvite = req.headers['x-guest-invite'] === 'true';

    console.log(`🔗 Processing invite join for token: ${token}, user: ${userId}, guest: ${isGuestInvite}`);

    // Find valid invite
    const inviteQuery = await pool.query(`
      SELECT pi.*, p.title, p.creator_id, u.username as inviter_name
      FROM project_invites pi
      JOIN projects p ON pi.project_id = p.id
      JOIN users u ON pi.invited_by = u.id
      WHERE pi.invite_token = $1 AND pi.expires_at > NOW() AND pi.used_at IS NULL
    `, [token]);

    if (inviteQuery.rows.length === 0) {
      console.log(`❌ Invalid or expired invite token: ${token}`);
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
      console.log(`⚠️ User ${userId} already collaborator on project ${invite.project_id}`);
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
        safeJSONStringify(invite.permissions),
        invite.invited_by,
        invite.created_at
      ]);

      // Mark invite as used
      await client.query(`
        UPDATE project_invites SET used_at = NOW(), used_by = $1 WHERE id = $2
      `, [userId, invite.id]);

      await client.query('COMMIT');

      console.log(`✅ Successfully added user ${userId} as collaborator to project ${invite.project_id}`);

      res.json({
        success: true,
        data: {
          message: `Successfully joined "${invite.title}" as ${invite.role}`,
          projectId: invite.project_id,
          role: invite.role,
          permissions: safeJSONParse(invite.permissions),
          isGuestTrial: isGuestInvite
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

// Get guest account info (for upgrade prompts)
router.get('/guest-info', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const userQuery = await pool.query(`
      SELECT 
        subscription_tier, 
        trial_end_date,
        is_guest,
        created_at,
        (trial_end_date - NOW()) as time_remaining
      FROM users 
      WHERE id = $1 AND (is_guest = true OR subscription_status = 'trialing')
    `, [userId]);

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Guest account not found', code: 'NOT_GUEST' }
      });
    }

    const user = userQuery.rows[0];
    const daysRemaining = user.time_remaining ? Math.ceil(user.time_remaining.days) : 0;

    res.json({
      success: true,
      data: {
        expiresAt: user.trial_end_date,
        daysRemaining,
        createdAt: user.created_at,
        isGuest: user.is_guest,
        needsUpgrade: daysRemaining <= 7 // Show upgrade prompt in last week
      }
    });

  } catch (error) {
    console.error('Guest info error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get guest info', code: 'GUEST_INFO_ERROR' }
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

router.get('/projects/viewer/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    console.log(`👁️ Viewer access for token: ${token}`);

    // Get project data with annotations and user details
    const projectQuery = `
      SELECT 
        p.id, 
        p.title, 
        pv.viewer_token,
        af.id as file_id, 
        af.filename, 
        af.version, 
        af.file_url, 
        af.s3_key,
        af.duration,
        af.waveform_data
      FROM projects p
      JOIN project_viewer_links pv ON p.id = pv.project_id
      JOIN audio_files af ON p.id = af.project_id AND af.is_active = true
      WHERE pv.viewer_token = $1 AND pv.expires_at > NOW()
      LIMIT 1
    `;

    const project = await pool.query(projectQuery, [token]);

    if (project.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invalid or expired view link' }
      });
    }

    const projectData = project.rows[0];

    // Generate signed URL for audio file
    let signedAudioUrl = projectData.file_url;
    
    if (projectData.s3_key) {
      try {
        const { s3UploadService } = await import('../services/s3-upload');
        signedAudioUrl = await s3UploadService.getSignedDownloadUrl(projectData.s3_key, 3600);
        console.log('✅ Generated signed audio URL for viewer');
      } catch (s3Error) {
        console.error('❌ Failed to generate signed audio URL:', s3Error);
        // Keep the original URL as fallback
      }
    }

    // Get annotations with user details
    const annotationsQuery = `
      SELECT 
        a.id,
        a.text,
        a.timestamp,
        a.annotation_type,
        a.status,
        a.priority,
        a.parent_id,
        a.voice_note_url,
        a.created_at,
        a.updated_at,
        u.id as user_id,
        u.username,
        u.profile_image,
        u.role as user_role
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.audio_file_id = $1
      ORDER BY a.timestamp ASC, a.created_at ASC
    `;

    const annotationsResult = await pool.query(annotationsQuery, [projectData.file_id]);

    // Process annotations with profile images and voice notes
    const annotations = await Promise.all(
      annotationsResult.rows.map(async (annotation) => {
        // Process profile image with S3ImageProcessor
        const processedUser = await S3ImageProcessor.processUserWithProfileImage({
          id: annotation.user_id,
          username: annotation.username,
          profileImage: annotation.profile_image,
          role: annotation.user_role
        });

        // Process voice note URL if it exists
        let processedVoiceNoteUrl = annotation.voice_note_url;
        if (processedVoiceNoteUrl && processedVoiceNoteUrl.includes('s3')) {
          try {
            const url = new URL(processedVoiceNoteUrl);
            const s3Key = url.pathname.substring(1);
            
            if (s3Key && s3Key.includes('voice-notes/')) {
              const { s3UploadService } = await import('../services/s3-upload');
              const signedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, 3600);
              
              if (signedUrl && signedUrl.includes('X-Amz-')) {
                processedVoiceNoteUrl = signedUrl;
              }
            }
          } catch (error) {
            console.error('Error processing voice note URL:', error);
            processedVoiceNoteUrl = null;
          }
        }

        return {
          id: annotation.id,
          text: annotation.text,
          timestamp: annotation.timestamp,
          type: annotation.annotation_type,
          status: annotation.status,
          priority: annotation.priority,
          parentId: annotation.parent_id,
          voiceNoteUrl: processedVoiceNoteUrl,
          createdAt: annotation.created_at,
          updatedAt: annotation.updated_at,
          createdBy: {
            id: processedUser.id,
            username: processedUser.username,
            profileImage: processedUser.profileImage,
            role: processedUser.role
          }
        };
      })
    );

    // Update last accessed timestamp (remove access_count reference)
    await pool.query(`
      UPDATE project_viewer_links 
      SET last_accessed_at = NOW()
      WHERE viewer_token = $1
    `, [token]);

    console.log(`✅ Viewer data served for project: ${projectData.title}, ${annotations.length} annotations`);

    res.json({
      success: true,
      data: {
        id: projectData.id,
        title: projectData.title,
        currentAudioFile: {
          id: projectData.file_id,
          filename: projectData.filename,
          version: projectData.version,
          fileUrl: signedAudioUrl, // Pre-signed URL included
          duration: projectData.duration,
          waveformData: projectData.waveform_data ? 
            (typeof projectData.waveform_data === 'string' ? 
              JSON.parse(projectData.waveform_data) : projectData.waveform_data) : null
        },
        annotations: annotations,
        isViewerMode: true
      }
    });

  } catch (error) {
    console.error('Get viewer project error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get project data' }
    });
  }
});router.get('/projects/viewer/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    console.log(`👁️ Viewer access for token: ${token}`);

    // Get project data with annotations and user details
    const projectQuery = `
      SELECT 
        p.id, 
        p.title, 
        pv.viewer_token,
        af.id as file_id, 
        af.filename, 
        af.version, 
        af.file_url, 
        af.s3_key,
        af.duration,
        af.waveform_data
      FROM projects p
      JOIN project_viewer_links pv ON p.id = pv.project_id
      JOIN audio_files af ON p.id = af.project_id AND af.is_active = true
      WHERE pv.viewer_token = $1 AND pv.expires_at > NOW()
      LIMIT 1
    `;

    const project = await pool.query(projectQuery, [token]);

    if (project.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invalid or expired view link' }
      });
    }

    const projectData = project.rows[0];

    // Generate signed URL for audio file
    let signedAudioUrl = projectData.file_url;
    
    if (projectData.s3_key) {
      try {
        const { s3UploadService } = await import('../services/s3-upload');
        signedAudioUrl = await s3UploadService.getSignedDownloadUrl(projectData.s3_key, 3600);
        console.log('✅ Generated signed audio URL for viewer');
      } catch (s3Error) {
        console.error('❌ Failed to generate signed audio URL:', s3Error);
        // Keep the original URL as fallback
      }
    }

    // Get annotations with user details
    const annotationsQuery = `
      SELECT 
        a.id,
        a.text,
        a.timestamp,
        a.annotation_type,
        a.status,
        a.priority,
        a.parent_id,
        a.voice_note_url,
        a.created_at,
        a.updated_at,
        u.id as user_id,
        u.username,
        u.profile_image,
        u.role as user_role
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.audio_file_id = $1
      ORDER BY a.timestamp ASC, a.created_at ASC
    `;

    const annotationsResult = await pool.query(annotationsQuery, [projectData.file_id]);

    // Process annotations with profile images and voice notes
    const annotations = await Promise.all(
      annotationsResult.rows.map(async (annotation) => {
        // Process profile image with S3ImageProcessor
        const processedUser = await S3ImageProcessor.processUserWithProfileImage({
          id: annotation.user_id,
          username: annotation.username,
          profileImage: annotation.profile_image,
          role: annotation.user_role
        });

        // Process voice note URL if it exists
        let processedVoiceNoteUrl = annotation.voice_note_url;
        if (processedVoiceNoteUrl && processedVoiceNoteUrl.includes('s3')) {
          try {
            const url = new URL(processedVoiceNoteUrl);
            const s3Key = url.pathname.substring(1);
            
            if (s3Key && s3Key.includes('voice-notes/')) {
              const { s3UploadService } = await import('../services/s3-upload');
              const signedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, 3600);
              
              if (signedUrl && signedUrl.includes('X-Amz-')) {
                processedVoiceNoteUrl = signedUrl;
              }
            }
          } catch (error) {
            console.error('Error processing voice note URL:', error);
            processedVoiceNoteUrl = null;
          }
        }

        return {
          id: annotation.id,
          text: annotation.text,
          timestamp: annotation.timestamp,
          type: annotation.annotation_type,
          status: annotation.status,
          priority: annotation.priority,
          parentId: annotation.parent_id,
          voiceNoteUrl: processedVoiceNoteUrl,
          createdAt: annotation.created_at,
          updatedAt: annotation.updated_at,
          createdBy: {
            id: processedUser.id,
            username: processedUser.username,
            profileImage: processedUser.profileImage,
            role: processedUser.role
          }
        };
      })
    );

    // Update last accessed timestamp (remove access_count reference)
    await pool.query(`
      UPDATE project_viewer_links 
      SET last_accessed_at = NOW()
      WHERE viewer_token = $1
    `, [token]);

    console.log(`✅ Viewer data served for project: ${projectData.title}, ${annotations.length} annotations`);

    res.json({
      success: true,
      data: {
        id: projectData.id,
        title: projectData.title,
        currentAudioFile: {
          id: projectData.file_id,
          filename: projectData.filename,
          version: projectData.version,
          fileUrl: signedAudioUrl, // Pre-signed URL included
          duration: projectData.duration,
          waveformData: projectData.waveform_data ? 
            (typeof projectData.waveform_data === 'string' ? 
              JSON.parse(projectData.waveform_data) : projectData.waveform_data) : null
        },
        annotations: annotations,
        isViewerMode: true
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { projectId } = req.params;
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
        error: { message: 'Access denied or project not found', code: 'ACCESS_DENIED' }
      });
    }

    // Get collaborators with user details
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
        u.updated_at as user_updated_at,
        inviter.username as inviter_name
      FROM project_collaborators pc
      JOIN users u ON pc.user_id = u.id
      LEFT JOIN users inviter ON pc.invited_by = inviter.id
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
          JSON.parse(collab.permissions) : collab.permissions,
        invitedBy: collab.invited_by,
        inviterName: collab.inviter_name,
        invitedAt: collab.invited_at,
        acceptedAt: collab.accepted_at,
        status: collab.status
      }))
    );

    res.json({
      success: true,
      data: collaborators
    });

  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get collaborators', code: 'GET_COLLABORATORS_ERROR' }
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { projectId, collaboratorId } = req.params;
    const userId = req.user!.userId;

    // Check if user can manage this project
    const permissionQuery = `
      SELECT 
        p.creator_id,
        pc.role as collaborator_role,
        target_pc.user_id as target_user_id,
        target_pc.role as target_role
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      LEFT JOIN project_collaborators target_pc ON target_pc.id = $3
      WHERE p.id = $1
    `;

    const permissionResult = await pool.query(permissionQuery, [projectId, userId, collaboratorId]);

    if (permissionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project or collaborator not found', code: 'NOT_FOUND' }
      });
    }

    const { creator_id, collaborator_role, target_user_id, target_role } = permissionResult.rows[0];
    const isCreator = creator_id === userId;
    const isAdmin = collaborator_role === 'admin';
    const isSelfRemoval = target_user_id === userId;

    // Permission checks
    if (!isCreator && !isAdmin && !isSelfRemoval) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Prevent removing the project creator
    if (target_user_id === creator_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot remove project creator', code: 'CANNOT_REMOVE_CREATOR' }
      });
    }

    // Prevent non-creators from removing admins (unless self-removal)
    if (!isCreator && target_role === 'admin' && !isSelfRemoval) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only creators can remove administrators', code: 'CANNOT_REMOVE_ADMIN' }
      });
    }

    // Remove collaborator
    const deleteResult = await pool.query(
      'DELETE FROM project_collaborators WHERE id = $1 RETURNING *',
      [collaboratorId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Collaborator not found', code: 'COLLABORATOR_NOT_FOUND' }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Collaborator removed successfully',
        removedCollaborator: deleteResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to remove collaborator', code: 'REMOVE_COLLABORATOR_ERROR' }
    });
  }
});

// Update collaborator permissions/role
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

    // Check if user can manage this project
    const permissionQuery = `
      SELECT 
        p.creator_id,
        pc.role as collaborator_role,
        target_pc.user_id as target_user_id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      LEFT JOIN project_collaborators target_pc ON target_pc.id = $3
      WHERE p.id = $1
    `;

    const permissionResult = await pool.query(permissionQuery, [projectId, userId, collaboratorId]);

    if (permissionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project or collaborator not found', code: 'NOT_FOUND' }
      });
    }

    const { creator_id, collaborator_role, target_user_id } = permissionResult.rows[0];
    const isCreator = creator_id === userId;
    const isAdmin = collaborator_role === 'admin';

    // Only creators and admins can update permissions
    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Prevent changing creator's permissions
    if (target_user_id === creator_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot modify project creator permissions', code: 'CANNOT_MODIFY_CREATOR' }
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (role !== undefined) {
      updates.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (permissions !== undefined) {
      updates.push(`permissions = $${paramCount}`);
      values.push(JSON.stringify(permissions));
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No fields to update', code: 'NO_UPDATE_FIELDS' }
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(collaboratorId);

    const updateQuery = `
      UPDATE project_collaborators 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, values);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Collaborator not found', code: 'COLLABORATOR_NOT_FOUND' }
      });
    }

    res.json({
      success: true,
      data: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update collaborator error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update collaborator', code: 'UPDATE_COLLABORATOR_ERROR' }
    });
  }
});

// Generate viewer-only link
router.post('/projects/:projectId/viewer-link', [
  authenticateToken,
  param('projectId').isUUID(),
  body('expiresIn').optional().isInt({ min: 1, max: 30 })
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
    const { expiresIn = 7 } = req.body;
    const userId = req.user!.userId;

    // Check if user can share this project
    const accessQuery = `
      SELECT 1 FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = $1 AND (
        p.creator_id = $2 OR 
        (pc.user_id = $2 AND pc.status = 'accepted' AND (
          pc.permissions->>'canInvite' = 'true' OR 
          pc.role IN ('admin', 'producer')
        ))
      )
      LIMIT 1
    `;

    const accessResult = await pool.query(accessQuery, [projectId, userId]);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Generate viewer token
    const viewerToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    // Store viewer link
    const viewerLinkId = uuidv4();
    await pool.query(`
      INSERT INTO viewer_links (
        id, project_id, viewer_token, created_by, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [viewerLinkId, projectId, viewerToken, userId, expiresAt]);

    const viewerUrl = `${process.env.FRONTEND_URL}/viewer/${viewerToken}`;

    res.json({
      success: true,
      data: {
        viewerUrl,
        viewerToken,
        expiresAt,
        expiresIn
      }
    });

  } catch (error) {
    console.error('Generate viewer link error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate viewer link', code: 'VIEWER_LINK_ERROR' }
    });
  }
});

// Get project invites (pending invitations)
router.get('/projects/:projectId/invites', [
  authenticateToken,
  param('projectId').isUUID()
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
    const userId = req.user!.userId;

    // Check if user can view invites (creator or admin)
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
        error: { message: 'Project not found', code: 'PROJECT_NOT_FOUND' }
      });
    }

    const { creator_id, collaborator_role } = permissionResult.rows[0];
    const isCreator = creator_id === userId;
    const isAdmin = collaborator_role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Get pending invites
    const invitesQuery = `
      SELECT 
        pi.*,
        u.username as inviter_name
      FROM project_invites pi
      JOIN users u ON pi.invited_by = u.id
      WHERE pi.project_id = $1 AND pi.used_at IS NULL AND pi.expires_at > NOW()
      ORDER BY pi.created_at DESC
    `;

    const invitesResult = await pool.query(invitesQuery, [projectId]);

    const invites = invitesResult.rows.map(invite => ({
      id: invite.id,
      projectId: invite.project_id,
      inviteToken: invite.invite_token,
      role: invite.role,
      permissions: typeof invite.permissions === 'string' ? 
        JSON.parse(invite.permissions) : invite.permissions,
      invitedBy: invite.invited_by,
      inviterName: invite.inviter_name,
      expiresAt: invite.expires_at,
      createsGuestAccount: invite.creates_guest_account,
      createdAt: invite.created_at,
      inviteLink: `${process.env.FRONTEND_URL}/join/${invite.invite_token}`
    }));

    res.json({
      success: true,
      data: invites
    });

  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get invites', code: 'GET_INVITES_ERROR' }
    });
  }
});

// Revoke/cancel invite
router.delete('/projects/:projectId/invites/:inviteId', [
  authenticateToken,
  param('projectId').isUUID(),
  param('inviteId').isUUID()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { projectId, inviteId } = req.params;
    const userId = req.user!.userId;

    // Check permissions and get invite info
    const inviteQuery = `
      SELECT 
        pi.*,
        p.creator_id,
        pc.role as collaborator_role
      FROM project_invites pi
      JOIN projects p ON pi.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $3
      WHERE pi.id = $1 AND pi.project_id = $2
    `;

    const inviteResult = await pool.query(inviteQuery, [inviteId, projectId, userId]);

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invite not found', code: 'INVITE_NOT_FOUND' }
      });
    }

    const invite = inviteResult.rows[0];
    const isCreator = invite.creator_id === userId;
    const isAdmin = invite.collaborator_role === 'admin';
    const isInviter = invite.invited_by === userId;

    // Only creator, admin, or the person who sent the invite can revoke it
    if (!isCreator && !isAdmin && !isInviter) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      });
    }

    // Mark invite as used (revoked)
    const revokeResult = await pool.query(
      'UPDATE project_invites SET used_at = NOW() WHERE id = $1 RETURNING *',
      [inviteId]
    );

    res.json({
      success: true,
      data: {
        message: 'Invite revoked successfully',
        revokedInvite: revokeResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Revoke invite error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to revoke invite', code: 'REVOKE_INVITE_ERROR' }
    });
  }
});

export default router;