// backend/src/routes/users-s3.ts - COMPLETE FIXED VERSION
import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
// REMOVED: import { UserModel } from '../models/User'; // This was causing 500 errors
import { pool } from '../config/database';
import { uploadImageS3, uploadImageToS3 } from '../middleware/upload-s3';
import { s3UploadService } from '../services/s3-upload';

const router = express.Router();

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

// Get current user profile - FIXED: Use direct database query instead of UserModel
router.get('/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    logWithTimestamp('🔍 Getting S3 profile for user:', userId);
    
    // FIXED: Direct database query instead of UserModel.findById()
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
        // Extract S3 key from URL
        const url = new URL(user.profile_image);
        const s3Key = url.pathname.substring(1); // Remove leading slash
        
        // Generate signed URL (valid for 1 hour)
        const signedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, 3600);
        user.profile_image = signedUrl;
        logWithTimestamp('🔗 Generated signed URL for profile image');
      } catch (error) {
        logWithTimestamp('⚠️ Failed to generate signed URL for profile image:', error);
        // Keep original URL as fallback
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

// Update user profile with S3 image upload - FIXED SQL syntax errors
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
          logWithTimestamp('📸 Processing profile image upload to S3:', {
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            userId
          });

          // Get user's current profile image to delete later
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

          // Upload new image to S3 (userId is required for image uploads)
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
        // FIXED: Missing $ prefix in SQL parameter
        updateFields.push(`profile_image = $${paramIndex++}`);
        updateValues.push(profileImageUrl);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'No fields to update' }
        });
      }

      // Add updated timestamp and user ID
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(userId);

      // FIXED: Missing $ prefix in WHERE clause
      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, role, subscription_tier, subscription_status,
                  profile_image, created_at, updated_at
      `;

      logWithTimestamp('📝 Executing update query:', { query, paramCount: updateValues.length });
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
          // Don't fail the request for cleanup errors
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

    // Get current profile image
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

    // Delete from S3 if it's an S3 URL
    if (profileImageUrl.includes('s3')) {
      try {
        const url = new URL(profileImageUrl);
        const s3Key = url.pathname.substring(1);
        await s3UploadService.deleteFile(s3Key);
        logWithTimestamp('🗑️ Deleted profile image from S3:', s3Key);
      } catch (error) {
        logWithTimestamp('⚠️ Failed to delete from S3:', error);
        // Continue with database update even if S3 delete fails
      }
    }

    // Remove from database
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

// Get signed URL for profile image (if needed separately)
router.get('/profile/image-url/:userId', authenticateToken, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    
    // Check if requesting user has permission (self or admin)
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
    }

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

    // Generate signed URL if it's an S3 image
    if (profileImageUrl.includes('s3')) {
      try {
        const url = new URL(profileImageUrl);
        const s3Key = url.pathname.substring(1);
        const signedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, 3600);
        
        res.json({
          success: true,
          data: {
            imageUrl: signedUrl,
            expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
          }
        });
      } catch (error) {
        logWithTimestamp('⚠️ Failed to generate signed URL:', error);
        res.json({
          success: true,
          data: { imageUrl: profileImageUrl } // Fallback to original URL
        });
      }
    } else {
      res.json({
        success: true,
        data: { imageUrl: profileImageUrl }
      });
    }

  } catch (error) {
    logWithTimestamp('❌ Get image URL error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get image URL' }
    });
  }
});

export default router;