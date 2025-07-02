// backend/src/routes/users-s3.ts - COMPLETE VERSION with all endpoints
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { uploadImageS3, uploadImageToS3 } from '../middleware/upload-s3'; 
import { s3UploadService } from '../services/s3-upload';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
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

    // ALWAYS generate signed URL for S3 images
    if (user.profile_image && user.profile_image.includes('s3')) {
      try {
        const url = new URL(user.profile_image);
        const s3Key = url.pathname.substring(1);
        
        logWithTimestamp('🔗 Generating signed URL for key:', s3Key);
        
        if (s3Key && !s3Key.includes('undefined') && s3Key.includes('users/')) {
          const signedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, 3600); // 1 hour expiry
          
          if (signedUrl && signedUrl.includes('X-Amz-')) {
            user.profile_image = signedUrl;
            logWithTimestamp('✅ Signed URL generated successfully');
            logWithTimestamp('🔍 Signed URL preview:', signedUrl.substring(0, 100) + '...');
          } else {
            logWithTimestamp('⚠️ Invalid signed URL generated');
          }
        } else {
          logWithTimestamp('⚠️ Invalid S3 key format:', s3Key);
        }
      } catch (error) {
        logWithTimestamp('❌ Failed to generate signed URL:', error);
        // Don't fail the request, just use original URL
      }
    } else if (user.profile_image) {
      logWithTimestamp('ℹ️ Profile image is not an S3 URL:', user.profile_image);
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
        profileImage: user.profile_image, // This will now always be a signed URL for S3 images
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

router.get('/profile/refresh-image-url', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    
    const user = await pool.query(
      'SELECT profile_image FROM users WHERE id = $1',
      [userId]
    );

    if (!user.rows[0]?.profile_image) {
      return res.status(404).json({
        success: false,
        error: { message: 'No profile image found' }
      });
    }

    const profileImageUrl = user.rows[0].profile_image;

    if (profileImageUrl.includes('s3')) {
      try {
        // Extract the original S3 key (might be from an expired signed URL)
        let s3Key;
        if (profileImageUrl.includes('X-Amz-')) {
          // It's a signed URL, extract the key from the path
          const url = new URL(profileImageUrl);
          s3Key = url.pathname.substring(1);
        } else {
          // It's a raw S3 URL
          const url = new URL(profileImageUrl);
          s3Key = url.pathname.substring(1);
        }
        
        logWithTimestamp('🔄 Refreshing signed URL for key:', s3Key);
        const newSignedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, 3600);
        
        res.json({
          success: true,
          data: {
            imageUrl: newSignedUrl,
            expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
          }
        });
      } catch (error) {
        logWithTimestamp('❌ Failed to refresh signed URL:', error);
        res.status(500).json({
          success: false,
          error: { message: 'Failed to refresh image URL' }
        });
      }
    } else {
      // Not an S3 URL, return as-is
      res.json({
        success: true,
        data: { imageUrl: profileImageUrl }
      });
    }

  } catch (error) {
    logWithTimestamp('❌ Refresh image URL error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to refresh image URL' }
    });
  }
});

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
    
    // Gather all user data - FIXED annotation query to use proper joins
    const [userResult, projectsResult, collaborationsResult, annotationsResult] = await Promise.all([
      // User data query (unchanged)
      pool.query('SELECT * FROM users WHERE id = $1', [userId]),
      
      // Projects created by user (unchanged)  
      pool.query('SELECT * FROM projects WHERE creator_id = $1', [userId]),
      
      // Collaborations user is part of (unchanged)
      pool.query(`
        SELECT p.*, u.username as creator_name 
        FROM project_collaborators pc
        JOIN projects p ON pc.project_id = p.id
        JOIN users u ON p.creator_id = u.id
        WHERE pc.user_id = $1
      `, [userId]),
      
      // FIXED: Annotations query with proper joins through audio_files
      pool.query(`
        SELECT a.*, p.title as project_title, af.filename as audio_filename
        FROM annotations a
        JOIN audio_files af ON a.audio_file_id = af.id
        JOIN projects p ON af.project_id = p.id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
      `, [userId])
    ]);

    const exportData = {
      user: userResult.rows[0],
      projects: projectsResult.rows,
      collaborations: collaborationsResult.rows,
      annotations: annotationsResult.rows,
      exportDate: new Date().toISOString(),
      exportInfo: {
        totalProjects: projectsResult.rows.length,
        totalCollaborations: collaborationsResult.rows.length,
        totalAnnotations: annotationsResult.rows.length
      }
    };

    // Remove sensitive data
    if (exportData.user) {
      delete exportData.user.password;
      delete exportData.user.stripe_customer_id;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="skribble-data-${userId}-${new Date().toISOString().split('T')[0]}.json"`);
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

router.put('/change-password', 
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
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
      const { currentPassword, newPassword } = req.body;

      // Get current user
      const result = await pool.query(
        'SELECT password FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
      }

      const user = result.rows[0];

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: { message: 'Current password is incorrect' }
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedNewPassword, userId]
      );

      logWithTimestamp('✅ Password changed successfully for user:', userId);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logWithTimestamp('❌ Change password error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to change password' }
      });
    }
  }
);

// Get referral stats (ADD THIS - to have it in users routes too for fallback)
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

// Get referral history (ADD THIS - to have it in users routes too for fallback)
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
      email: row.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
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