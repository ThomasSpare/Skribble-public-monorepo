// backend/src/routes/users.ts
import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { UserModel } from '../models/User';
import { pool } from '../config/database';

const router = express.Router();

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

// Update user profile
router.put('/profile', 
  authenticateToken,
  [
    body('username').optional().isLength({ min: 3, max: 30 }).trim(),
    body('role').optional().isIn(['producer', 'artist', 'both']),
    // Simplified validation - just check if it's a string
    body('profileImage').optional().isString()
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            details: errors.array()
          }
        });
      }

      const userId = req.user.userId;
      const { username, role, profileImage } = req.body;

      console.log('📝 Profile update request:', { userId, username, role, profileImage });

      // Check if username is available (if changing) - direct query
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

      // Build update query dynamically
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (username) {
        updateFields.push(`username = $${paramCount}`);
        updateValues.push(username);
        paramCount++;
      }

      if (role) {
        updateFields.push(`role = $${paramCount}`);
        updateValues.push(role);
        paramCount++;
      }

      if (profileImage !== undefined) {
        updateFields.push(`profile_image = $${paramCount}`);
        updateValues.push(profileImage);
        paramCount++;
      }

      // Always update the updated_at field
      updateFields.push(`updated_at = $${paramCount}`);
      updateValues.push(new Date());
      paramCount++;

      // Add userId for WHERE clause
      updateValues.push(userId);

      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, username, role, subscription_tier, 
                  profile_image, created_at, updated_at
      `;

      console.log('💾 Executing update query:', updateQuery);
      console.log('💾 With values:', updateValues);

      const result = await pool.query(updateQuery, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
      }

      const updatedUser = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        username: result.rows[0].username,
        role: result.rows[0].role,
        subscriptionTier: result.rows[0].subscription_tier,
        profileImage: result.rows[0].profile_image,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at
      };

      console.log('✅ User updated successfully:', updatedUser.id);

      res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully'
      });

    } catch (error: any) {
      console.error('❌ Update profile error:', error);
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to update profile' }
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

export default router;