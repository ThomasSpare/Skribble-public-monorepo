// backend/src/routes/users.ts
import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { UserModel } from '../models/User';
import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get profile' }
    });
  }
});


router.put('/profile', 
  authenticateToken,
  upload.single('profileImage'),
  [
    body('username').optional().isLength({ min: 3, max: 30 }).trim(),
    body('role').optional().isIn(['producer', 'artist', 'both']),
    body('email').optional().isEmail().normalizeEmail()
  ],
  async (req: any, res: any) => {
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

      const userId = req.user.userId;
      const { username, role, email } = req.body;

      // Check if username is available (if changing)
      if (username) {
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, userId]
        );
        
        if (existingUser.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: { message: 'Username already taken' }
          });
        }
      }

      // Check if email is available (if changing)
      if (email) {
        const existingEmail = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, userId]
        );
        
        if (existingEmail.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: { message: 'Email already taken' }
          });
        }
      }

      let profileImageUrl = null;

      if (req.file) {
        try {
          // Use Railway's file structure - corrected path
          const uploadDir = process.env.NODE_ENV === 'production' 
            ? '/app/uploads/images'  // Railway production path
            : path.join(process.cwd(), 'uploads', 'images'); // Local development
          
          // Create directory if it doesn't exist
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log('📁 Created upload directory:', uploadDir);
          }

          // Generate unique filename with proper extension
          const fileExtension = path.extname(req.file.originalname) || '.jpg';
          const filename = `profile-${userId}-${Date.now()}${fileExtension}`;
          const filepath = path.join(uploadDir, filename);
          
          // Save the file
          fs.writeFileSync(filepath, req.file.buffer);
          
          // Store the URL path (what the browser will request)
          profileImageUrl = `/uploads/images/${filename}`;
          
          console.log('📸 Image saved to:', filepath);
          console.log('🔗 Image URL stored:', profileImageUrl);
          
        } catch (uploadError) {
          console.error('❌ Image upload error:', uploadError);
          return res.status(500).json({
            success: false,
            error: { message: 'Failed to upload image' }
          });
        }
      }

      // Build update query dynamically
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (username) {
        updateFields.push(`username = $${paramIndex++}`);
        updateValues.push(username);
      }
      if (email) {
        updateFields.push(`email = $${paramIndex++}`);
        updateValues.push(email);
      }
      if (role) {
        updateFields.push(`role = $${paramIndex++}`);
        updateValues.push(role);
      }
      if (profileImageUrl) {
        updateFields.push(`profile_image = $${paramIndex++}`);
        updateValues.push(profileImageUrl);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'No fields to update' }
        });
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(userId); // For WHERE clause

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, username, role, subscription_tier, profile_image, created_at, updated_at
      `;

      const result = await pool.query(query, updateValues);
      
      res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error: any) {
      console.error('❌ Update profile error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update profile' }
      });
    }
  }
);

// Search users (for collaboration invites)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || (q as string).length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Search query must be at least 2 characters',
          code: 'INVALID_SEARCH_QUERY'
        }
      });
    }

    const users = await UserModel.search(q as string, 10);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to search users',
        code: 'SEARCH_USERS_ERROR'
      }
    });
  }
});

/// Get user stats
router.get('/stats', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const stats = await UserModel.getStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get user stats' }
    });
  }
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Username must be between 3 and 30 characters',
          code: 'INVALID_USERNAME_LENGTH'
        }
      });
    }

    const isAvailable = await UserModel.isUsernameAvailable(username);

    res.json({
      success: true,
      data: {
        username,
        available: isAvailable
      }
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to check username availability',
        code: 'CHECK_USERNAME_ERROR'
      }
    });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized: user not found in request',
          code: 'UNAUTHORIZED'
        }
      });
    }
    const userId = req.user.userId;

    const deleted = await UserModel.delete(userId);
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete account',
          code: 'DELETE_ACCOUNT_ERROR'
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Account deleted successfully'
      }
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete account',
        code: 'DELETE_ACCOUNT_ERROR'
      }
    });
  }
});

// Get user by username (public profile) - PUT THIS LAST to avoid conflicts
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await UserModel.findByUsername(username);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    // Return limited public profile
    const publicProfile = {
      id: user.id,
      username: user.username,
      role: user.role,
      profileImage: user.profileImage,
      createdAt: user.createdAt
    };

    res.json({
      success: true,
      data: publicProfile
    });
  } catch (error) {
    console.error('Get user by username error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get user',
        code: 'GET_USER_ERROR'
      }
    });
  }
});

// Export user data
router.get('/export-data', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    
    // Gather all user data
    const [userResult, projectsResult, collaborationsResult, annotationsResult] = await Promise.all([
      pool.query('SELECT * FROM users WHERE id = $1', [userId]),
      pool.query('SELECT * FROM projects WHERE creator_id = $1', [userId]),
      pool.query(`
        SELECT p.*, u.username as creator_name 
        FROM project_collaborators pc
        JOIN projects p ON pc.project_id = p.id
        JOIN users u ON p.creator_id = u.id
        WHERE pc.user_id = $1
      `, [userId]),
      pool.query(`
        SELECT a.*, p.title as project_title
        FROM annotations a
        JOIN projects p ON a.project_id = p.id
        WHERE a.user_id = $1
      `, [userId])
    ]);

    const exportData = {
      user: userResult.rows[0],
      projects: projectsResult.rows,
      collaborations: collaborationsResult.rows,
      annotations: annotationsResult.rows,
      exportDate: new Date().toISOString()
    };

    // Remove sensitive data
    delete exportData.user.password;
    delete exportData.user.stripe_customer_id;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="skribble-data-${userId}.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to export data' }
    });
  }
});

router.get('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT notification_settings FROM users WHERE id = $1
    `, [userId]);

    const settings = result.rows[0]?.notification_settings || {
      collaborations: true,
      projects: true,
      weekly: true,
      marketing: false,
      email: true,
      push: true
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch notification settings' }
    });
  }
});

// Update notification settings
router.put('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = req.body;

    await pool.query(`
      UPDATE users 
      SET notification_settings = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(settings), userId]);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update notification settings' }
    });
  }
});


// Get privacy settings
router.get('/privacy-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT privacy_settings FROM users WHERE id = $1
    `, [userId]);

    const settings = result.rows[0]?.privacy_settings || {
      profileVisibility: 'public',
      showEmail: false,
      allowDirectMessages: true,
      indexInSearch: true
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch privacy settings' }
    });
  }
});

// Update privacy settings
router.put('/privacy-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = req.body;

    await pool.query(`
      UPDATE users 
      SET privacy_settings = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(settings), userId]);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update privacy settings' }
    });
  }
});

router.post('/generate-referral-code', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;

    // Check if user already has a referral code
    const user = await pool.query(
      'SELECT referral_code FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    let referralCode = user.rows[0].referral_code;
    
    // Generate new referral code if user doesn't have one
    if (!referralCode) {
      referralCode = `REF_${userId.slice(0, 8)}_${Date.now().toString(36).toUpperCase()}`;
      
      await pool.query(
        'UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2',
        [referralCode, userId]
      );
    }

    res.json({
      success: true,
      data: { referralCode }
    });

  } catch (error) {
    console.error('Generate referral code error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate referral code' }
    });
  }
});

// Get referral stats
router.get('/referral-stats', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    
    const query = `
      SELECT 
        u.referral_code,
        COUNT(CASE WHEN ref.subscription_tier != 'free' AND ref.subscription_status = 'active' THEN 1 END) as successful_referrals,
        COUNT(CASE WHEN ref.subscription_tier = 'free' OR ref.subscription_status != 'active' THEN 1 END) as pending_referrals,
        COUNT(CASE WHEN ref.subscription_tier != 'free' AND ref.subscription_status = 'active' THEN 1 END) as rewards_earned
      FROM users u
      LEFT JOIN users ref ON ref.referred_by = u.referral_code
      WHERE u.id = $1
      GROUP BY u.referral_code
    `;

    const result = await pool.query(query, [userId]);
    
    const stats = result.rows[0] || {
      referral_code: null,
      successful_referrals: 0,
      pending_referrals: 0,
      rewards_earned: 0
    };

    // Convert string numbers to integers
    stats.successful_referrals = parseInt(stats.successful_referrals) || 0;
    stats.pending_referrals = parseInt(stats.pending_referrals) || 0;
    stats.rewards_earned = parseInt(stats.rewards_earned) || 0;

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch referral stats' }
    });
  }
});

// Get referral history (bonus endpoint)
router.get('/referral-history', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    
    // Get user's referral code first
    const userResult = await pool.query(
      'SELECT referral_code FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    const referralCode = userResult.rows[0].referral_code;

    if (!referralCode) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get referred users
    const referralsResult = await pool.query(`
      SELECT 
        id,
        username,
        email,
        subscription_tier,
        subscription_status,
        created_at
      FROM users 
      WHERE referred_by = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [referralCode]);

    const referrals = referralsResult.rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Partially hide email for privacy
      subscriptionTier: row.subscription_tier,
      subscriptionStatus: row.subscription_status,
      createdAt: row.created_at,
      rewardEarned: row.subscription_tier !== 'free' && row.subscription_status === 'active'
    }));

    res.json({
      success: true,
      data: referrals
    });

  } catch (error) {
    console.error('Get referral history error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch referral history' }
    });
  }
});

router.get('/export-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Gather all user data
    const [userResult, projectsResult, collaborationsResult, annotationsResult] = await Promise.all([
      pool.query('SELECT * FROM users WHERE id = $1', [userId]),
      pool.query('SELECT * FROM projects WHERE creator_id = $1', [userId]),
      pool.query(`
        SELECT p.*, u.username as creator_name 
        FROM project_collaborators pc
        JOIN projects p ON pc.project_id = p.id
        JOIN users u ON p.creator_id = u.id
        WHERE pc.user_id = $1
      `, [userId]),
      pool.query(`
        SELECT a.*, p.title as project_title
        FROM annotations a
        JOIN projects p ON a.project_id = p.id
        WHERE a.user_id = $1
      `, [userId])
    ]);

    const exportData = {
      user: userResult.rows[0],
      projects: projectsResult.rows,
      collaborations: collaborationsResult.rows,
      annotations: annotationsResult.rows,
      exportDate: new Date().toISOString()
    };

    // Remove sensitive data
    delete exportData.user.password;
    delete exportData.user.stripe_customer_id;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="skribble-data-${userId}.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to export data' }
    });
  }
});

// Get subscription info
router.get('/subscription', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT subscription_tier, subscription_status, trial_end_date,
             stripe_customer_id, stripe_subscription_id
      FROM users WHERE id = $1
    `, [userId]);

    const user = result.rows[0];
    const subscriptionInfo = {
      tier: user.subscription_tier || 'free',
      status: user.subscription_status || 'inactive',
      trialEnd: user.trial_end_date,
      hasStripeSubscription: !!user.stripe_subscription_id
    };

    res.json({
      success: true,
      data: subscriptionInfo
    });
  } catch (error) {
    console.error('Get subscription info error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch subscription info' }
    });
  }
});


export default router;