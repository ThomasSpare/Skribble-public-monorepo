// backend/src/middleware/guestPermissions.ts
import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';

interface GuestUser {
  userId: string;
  subscriptionTier: string;
  guestExpiresAt?: string;
  isGuest?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: GuestUser;
    }
  }
}

// Check if guest account has expired
export const checkGuestExpiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    if (!user || user.subscriptionTier !== 'artist_guest') {
      return next();
    }

    // Check if guest account has expired
    const userQuery = await pool.query(
      'SELECT guest_expires_at, subscription_status FROM users WHERE id = $1',
      [user.userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found', code: 'USER_NOT_FOUND' }
      });
    }

    const { guest_expires_at, subscription_status } = userQuery.rows[0];
    
    if (guest_expires_at && new Date(guest_expires_at) < new Date()) {
      // Guest account has expired
      await pool.query(
        'UPDATE users SET subscription_status = $1 WHERE id = $2',
        ['expired', user.userId]
      );

      return res.status(403).json({
        success: false,
        error: { 
          message: 'Guest account has expired. Please upgrade to continue.', 
          code: 'GUEST_EXPIRED',
          needsUpgrade: true
        }
      });
    }

    next();
  } catch (error) {
    console.error('Guest expiry check error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to verify account status', code: 'VERIFICATION_ERROR' }
    });
  }
};

// Restrict guest account permissions
export const restrictGuestActions = (allowedActions: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user || user.subscriptionTier !== 'artist_guest') {
      return next();
    }

    const action = req.route?.path || req.path;
    const method = req.method;

    // Define restricted actions for guest accounts
    const restrictedActions = [
      'POST:/projects', // Can't create projects
      'POST:/projects/:id/invite', // Can't invite others
      'DELETE:/projects/:id', // Can't delete projects
      'PUT:/projects/:id/settings', // Can't modify project settings
      'POST:/users/generate-referral-code', // Can't generate referrals
    ];

    // Check if current action is restricted
    const currentAction = `${method}:${action}`;
    const isRestricted = restrictedActions.some(restricted => {
      return currentAction.includes(restricted.replace(':id', ''));
    });

    if (isRestricted && !allowedActions.includes(currentAction)) {
      return res.status(403).json({
        success: false,
        error: { 
          message: 'This action requires a paid account. Please upgrade to continue.', 
          code: 'GUEST_RESTRICTION',
          needsUpgrade: true,
          restrictedAction: currentAction
        }
      });
    }

    next();
  };
};

// Check guest collaboration permissions
export const checkGuestCollaborationAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    if (!user || user.subscriptionTier !== 'artist_guest') {
      return next();
    }

    const projectId = req.params.projectId || req.params.id;
    
    if (!projectId) {
      return next();
    }

    // Check if guest is actually a collaborator on this project
    const collaborationQuery = await pool.query(`
      SELECT pc.role, pc.permissions, u.guest_project_id
      FROM project_collaborators pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.user_id = $1 AND pc.project_id = $2 AND pc.status = 'accepted'
    `, [user.userId, projectId]);

    if (collaborationQuery.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { 
          message: 'Access denied. You are not a collaborator on this project.', 
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Add collaboration info to request for use in route handlers
    req.guestCollaboration = collaborationQuery.rows[0];
    
    next();
  } catch (error) {
    console.error('Guest collaboration check error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to verify project access', code: 'ACCESS_CHECK_ERROR' }
    });
  }
};

// Limit guest account usage
export const limitGuestUsage = (limits: {
  maxCommentsPerDay?: number;
  maxVoiceNotesPerDay?: number;
  maxProjectsAccess?: number;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user || user.subscriptionTier !== 'artist_guest') {
        return next();
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check daily comment limit
      if (limits.maxCommentsPerDay && req.path.includes('/comments') && req.method === 'POST') {
        const commentCount = await pool.query(`
          SELECT COUNT(*) as count 
          FROM project_comments 
          WHERE user_id = $1 AND created_at >= $2
        `, [user.userId, today]);

        if (parseInt(commentCount.rows[0].count) >= limits.maxCommentsPerDay) {
          return res.status(429).json({
            success: false,
            error: { 
              message: `Daily comment limit reached (${limits.maxCommentsPerDay}). Upgrade for unlimited comments.`, 
              code: 'DAILY_LIMIT_REACHED',
              needsUpgrade: true
            }
          });
        }
      }

      // Check daily voice note limit
      if (limits.maxVoiceNotesPerDay && req.path.includes('/voice-notes') && req.method === 'POST') {
        const voiceNoteCount = await pool.query(`
          SELECT COUNT(*) as count 
          FROM project_comments 
          WHERE user_id = $1 AND audio_url IS NOT NULL AND created_at >= $2
        `, [user.userId, today]);

        if (parseInt(voiceNoteCount.rows[0].count) >= limits.maxVoiceNotesPerDay) {
          return res.status(429).json({
            success: false,
            error: { 
              message: `Daily voice note limit reached (${limits.maxVoiceNotesPerDay}). Upgrade for unlimited voice notes.`, 
              code: 'DAILY_LIMIT_REACHED',
              needsUpgrade: true
            }
          });
        }
      }

      // Check project access limit
      if (limits.maxProjectsAccess) {
        const projectCount = await pool.query(`
          SELECT COUNT(DISTINCT project_id) as count 
          FROM project_collaborators 
          WHERE user_id = $1 AND status = 'accepted'
        `, [user.userId]);

        if (parseInt(projectCount.rows[0].count) >= limits.maxProjectsAccess) {
          return res.status(429).json({
            success: false,
            error: { 
              message: `Project access limit reached (${limits.maxProjectsAccess}). Upgrade for more projects.`, 
              code: 'PROJECT_LIMIT_REACHED',
              needsUpgrade: true
            }
          });
        }
      }

      next();
    } catch (error) {
      console.error('Guest usage limit error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to check usage limits', code: 'LIMIT_CHECK_ERROR' }
      });
    }
  };
};

// Clean up expired guest accounts (for scheduled jobs)
export const cleanupExpiredGuestAccounts = async () => {
  try {
    const result = await pool.query(`
      SELECT cleanup_expired_guest_accounts() as deleted_count
    `);
    
    const deletedCount = result.rows[0]?.deleted_count || 0;
    console.log(`Cleaned up ${deletedCount} expired guest accounts`);
    
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup expired guest accounts:', error);
    throw error;
  }
};

declare global {
  namespace Express {
    interface Request {
      guestCollaboration?: {
        role: string;
        permissions: any;
        guest_project_id?: string;
      };
    }
  }
}