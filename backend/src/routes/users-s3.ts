// backend/src/routes/users-s3.ts - COMPLETE VERSION with all endpoints
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { uploadImageS3, uploadImageToS3 } from '../middleware/upload-s3'; 
import { s3UploadService } from '../services/s3-upload';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';

const router = express.Router();

// Logging helper
const logWithTimestamp = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Users-S3 routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Get current user profile
router.get('/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    logWithTimestamp('🔍 Getting S3 profile for user:', userId);
    
    const result = await pool.query(`
      SELECT id, email, username, role, subscription_tier, subscription_status,
             profile_image, stripe_customer_id, referral_code, referred_by,
             created_at, updated_at 
      FROM users WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      logWithTimestamp('❌ User not found:', userId);
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    const user = result.rows[0];
    logWithTimestamp('✅ User profile found:', user.username);

    // If user has S3 profile image, generate signed URL for security
    if (user.profile_image && user.profile_image.includes('s3')) {
      try {
        const url = new URL(user.profile_image);
        const s3Key = url.pathname.substring(1);
        
        if (s3Key && !s3Key.includes('undefined') && s3Key.includes('users/')) {
          const signedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, 3600);
          if (signedUrl && signedUrl.includes('X-Amz-')) {
            user.profile_image = signedUrl;
            logWithTimestamp('🔗 Generated signed URL for profile image');
          }
        }
      } catch (error) {
        logWithTimestamp('⚠️ Failed to generate signed URL for profile image:', error);
      }
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        subscriptionTier: user.subscription_tier,
        subscriptionStatus: user.subscription_status || 'active',
        profileImage: user.profile_image,
        stripeCustomerId: user.stripe_customer_id,
        referralCode: user.referral_code,
        referredBy: user.referred_by,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error: any) {
    logWithTimestamp('❌ Get S3 profile error:', error);
    res.status(500).json({
      success: false,
      error: { 
        message: 'Failed to get profile',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

// Update user profile with S3 image upload
router.put('/profile', 
  authenticateToken,
  uploadImageS3.single('profileImage'),
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
      logWithTimestamp('🔄 Updating S3 profile:', { userId, username, role, email, hasFile: !!req.file });

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
      let oldProfileImageKey = null;

      // Handle image upload to S3
      if (req.file) {
        try {
          const currentUser = await pool.query(
            'SELECT profile_image FROM users WHERE id = $1',
            [userId]
          );

          if (currentUser.rows[0]?.profile_image?.includes('s3')) {
            try {
              const oldUrl = new URL(currentUser.rows[0].profile_image);
              oldProfileImageKey = oldUrl.pathname.substring(1);
            } catch (error) {
              logWithTimestamp('⚠️ Failed to parse old profile image URL:', error);
            }
          }

          const s3Result = await uploadImageToS3(req.file, userId);
          profileImageUrl = s3Result.location;
          
          logWithTimestamp('✅ Profile image uploaded to S3:', {
            key: s3Result.key,
            location: s3Result.location
          });
          
        } catch (uploadError) {
          logWithTimestamp('❌ S3 image upload error:', uploadError);
          return res.status(500).json({
            success: false,
            error: { message: 'Failed to upload image to S3' }
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
      updateValues.push(userId);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, role, subscription_tier, subscription_status,
                  profile_image, created_at, updated_at
      `;

      const result = await pool.query(query, updateValues);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
      }

      const updatedUser = result.rows[0];

      // Delete old profile image from S3 if we uploaded a new one
      if (oldProfileImageKey && profileImageUrl) {
        try {
          await s3UploadService.deleteFile(oldProfileImageKey);
          logWithTimestamp('🗑️ Deleted old profile image from S3:', oldProfileImageKey);
        } catch (deleteError) {
          logWithTimestamp('⚠️ Failed to delete old profile image:', deleteError);
        }
      }

      // Generate signed URL for the response if we have an S3 image
      if (updatedUser.profile_image && updatedUser.profile_image.includes('s3')) {
        try {
          const url = new URL(updatedUser.profile_image);
          const s3Key = url.pathname.substring(1);
          const signedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, 3600);
          updatedUser.profile_image = signedUrl;
          logWithTimestamp('🔗 Generated signed URL for updated profile image');
        } catch (error) {
          logWithTimestamp('⚠️ Failed to generate signed URL:', error);
        }
      }

      res.json({
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          role: updatedUser.role,
          subscriptionTier: updatedUser.subscription_tier,
          subscriptionStatus: updatedUser.subscription_status || 'active',
          profileImage: updatedUser.profile_image,
          createdAt: updatedUser.created_at,
          updatedAt: updatedUser.updated_at
        },
        message: 'Profile updated successfully'
      });

    } catch (error) {
      logWithTimestamp('❌ S3 Profile update error:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: 'Failed to update profile',
          details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        }
      });
    }
  }
);

// Delete user profile image
router.delete('/profile/image', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;

    const user = await pool.query(
      'SELECT profile_image FROM users WHERE id = $1',
      [userId]
    );

    if (!user.rows[0]?.profile_image) {
      return res.status(404).json({
        success: false,
        error: { message: 'No profile image to delete' }
      });
    }

    const profileImageUrl = user.rows[0].profile_image;

    if (profileImageUrl.includes('s3')) {
      try {
        const url = new URL(profileImageUrl);
        const s3Key = url.pathname.substring(1);
        await s3UploadService.deleteFile(s3Key);
        logWithTimestamp('🗑️ Deleted profile image from S3:', s3Key);
      } catch (error) {
        logWithTimestamp('⚠️ Failed to delete from S3:', error);
      }
    }

    await pool.query(
      'UPDATE users SET profile_image = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: 'Profile image deleted successfully'
    });

  } catch (error) {
    logWithTimestamp('❌ Profile image deletion error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete profile image' }
    });
  }
});

// === NOTIFICATION SETTINGS ENDPOINTS ===
router.get('/notification-settings', authenticateToken, async (req: any, res: any) => {
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

router.put('/notification-settings', authenticateToken, async (req: any, res: any) => {
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

// === PRIVACY SETTINGS ENDPOINTS ===
router.get('/privacy-settings', authenticateToken, async (req: any, res: any) => {
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

router.put('/privacy-settings', authenticateToken, async (req: any, res: any) => {
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

// === DATA EXPORT ENDPOINT ===
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

// === DELETE ACCOUNT ENDPOINT ===
router.delete('/delete-account', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;

    // Delete user account and all associated data
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

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

// === REFERRAL CODE GENERATION ===
router.post('/generate-referral-code', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    
    // Generate a unique referral code
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await pool.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2',
      [referralCode, userId]
    );

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

export default router;