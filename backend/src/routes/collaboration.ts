// backend/src/routes/collaboration.ts - Updated with Guest Account Support
import express, { Request, Response } from 'express';
import { body, validationResult, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = express.Router();

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

// Join project via invite (supports guest account creation)
router.post('/join/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { createGuestAccount, guestName, guestEmail } = req.body;

    // Validate invite token
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

    // Handle guest account creation
    if (createGuestAccount && invite.creates_guest_account) {
      return await createGuestAccountAndJoin(invite, guestName, guestEmail, res);
    }

    // Handle existing user joining (requires authentication)
    const authResult = authenticateToken(req, res, () => {});
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required for non-guest access', code: 'AUTH_REQUIRED' }
      });
    }

    const userId = req.user.userId;

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

    // Add user as collaborator
    await addUserAsCollaborator(invite, userId);

    res.json({
      success: true,
      data: {
        projectId: invite.project_id,
        role: invite.role,
        message: 'Successfully joined project'
      }
    });

  } catch (error) {
    console.error('Join project error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to join project', code: 'JOIN_ERROR' }
    });
  }
});

// Helper function to create guest account and join project
async function createGuestAccountAndJoin(invite: any, guestName: string, guestEmail: string, res: Response) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id, subscription_tier FROM users WHERE email = $1',
      [guestEmail]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { 
          message: 'An account with this email already exists. Please sign in instead.', 
          code: 'EMAIL_EXISTS',
          requiresSignIn: true
        }
      });
    }

    // Create guest user account
    const guestUserId = uuidv4();
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const guestExpiresAt = new Date();
    guestExpiresAt.setDate(guestExpiresAt.getDate() + 30); // 30 days from now

    await client.query(`
      INSERT INTO users (
        id, email, username, password, role, subscription_tier, 
        subscription_status, guest_expires_at, guest_invited_by, 
        guest_project_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    `, [
      guestUserId, 
      guestEmail, 
      guestName, 
      hashedPassword, 
      'artist', 
      'artist_guest',
      'active',
      guestExpiresAt,
      invite.invited_by,
      invite.project_id
    ]);

    // Add as collaborator
    const collaborationId = uuidv4();
    await client.query(`
      INSERT INTO project_collaborators (
        id, project_id, user_id, role, permissions, invited_by, 
        invited_at, accepted_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'accepted')
    `, [
      collaborationId, 
      invite.project_id, 
      guestUserId, 
      invite.role, 
      invite.permissions, 
      invite.invited_by,
      invite.created_at
    ]);

    // Mark invite as used and link to guest user
    await client.query(`
      UPDATE project_invites 
      SET used_at = NOW(), guest_user_id = $1 
      WHERE id = $2
    `, [guestUserId, invite.id]);

    await client.query('COMMIT');

    // Generate temporary JWT for guest user
    const jwt = require('jsonwebtoken');
    const guestToken = jwt.sign(
      { 
        userId: guestUserId, 
        email: guestEmail, 
        role: 'artist',
        subscriptionTier: 'artist_guest',
        isGuest: true,
        expiresAt: guestExpiresAt
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      data: {
        isGuestAccount: true,
        token: guestToken,
        user: {
          id: guestUserId,
          email: guestEmail,
          username: guestName,
          role: 'artist',
          subscriptionTier: 'artist_guest',
          guestExpiresAt
        },
        projectId: invite.project_id,
        expiresIn: 30,
        message: 'Guest account created successfully'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to add user as collaborator
async function addUserAsCollaborator(invite: any, userId: string) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

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
      UPDATE project_invites 
      SET used_at = NOW() 
      WHERE id = $1
    `, [invite.id]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Get guest account info (for upgrade prompts)
router.get('/guest-info', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const userQuery = await pool.query(`
      SELECT 
        subscription_tier, 
        guest_expires_at,
        created_at,
        (guest_expires_at - NOW()) as time_remaining
      FROM users 
      WHERE id = $1 AND subscription_tier = 'artist_guest'
    `, [userId]);

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Guest account not found', code: 'NOT_GUEST' }
      });
    }

    const user = userQuery.rows[0];
    const daysRemaining = Math.ceil(user.time_remaining.days);

    res.json({
      success: true,
      data: {
        expiresAt: user.guest_expires_at,
        daysRemaining,
        createdAt: user.created_at,
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

export default router;