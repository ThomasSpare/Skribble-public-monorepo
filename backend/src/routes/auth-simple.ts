// backend/src/routes/auth-simple.ts - COMPLETE FIXED VERSION
import express from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  subscriptionTier: string;
}

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Register - Updated to handle both free and paid registrations
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).trim(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['producer', 'artist', 'both']),
  body('tier').isIn(['indie', 'producer', 'studio']), // REQUIRED - No free tier allowed
  body('referralCode').optional().trim()
], async (req: express.Request, res: express.Response) => {
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

    const { email, username, password, role, tier, referralCode } = req.body;

    // Enforce paid plan requirement
    if (!tier || tier === 'free') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'A paid plan is required for new registrations. Please select Indie, Producer, or Studio plan.',
          code: 'PAID_PLAN_REQUIRED'
        }
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'User already exists with this email',
          code: 'USER_EXISTS'
        }
      });
    }

    // Check if username is taken
    const existingUsername = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existingUsername.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Username already taken',
          code: 'USERNAME_TAKEN'
        }
      });
    }

    // Validate referral code if provided
    let referrerExists = true;
    if (referralCode) {
      const referrer = await pool.query(
        'SELECT id, username FROM users WHERE referral_code = $1',
        [referralCode]
      );

      if (referrer.rows.length === 0) {
        referrerExists = false;
        console.warn(`Invalid referral code provided: ${referralCode}`);
        // Don't fail registration, just ignore invalid referral code
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with PENDING status (payment required)
    const userId = uuidv4();
    const now = new Date();
    
    const result = await pool.query(`
      INSERT INTO users (
        id, email, username, password, role, subscription_tier, 
        subscription_status, referred_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email, username, role, subscription_tier, subscription_status, created_at, updated_at
    `, [
      userId, 
      email, 
      username, 
      hashedPassword, 
      role, 
      tier,
      'pending', // Always pending for paid plans until payment is completed
      (referralCode && referrerExists) ? referralCode : null,
      now, 
      now
    ]);

    const user = result.rows[0];

    // Generate tokens with proper payload
    const payload: JWTPayload = {
      userId: String(user.id),
      email: String(user.email),
      role: String(user.role),
      subscriptionTier: String(user.subscription_tier || 'free')
    };

    const token = jwt.sign(
      payload,
      JWT_SECRET,
      { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'skribble-app',
        audience: 'skribble-users'
      } as SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: String(user.id), type: 'refresh' },
      JWT_REFRESH_SECRET,
      { 
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        issuer: 'skribble-app',
        audience: 'skribble-users'
      } as SignOptions
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          subscriptionTier: user.subscription_tier,
          subscriptionStatus: user.subscription_status,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        token,
        refreshToken,
        requiresPayment: true, // Always true for new registrations
        message: `Registration successful! Please complete payment for your ${tier} plan to activate your account.`,
        planSelected: tier,
        referralApplied: !!(referralCode && referrerExists)
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Registration failed',
        code: 'REGISTRATION_ERROR',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      }
    });
  }
});

// Login - Fixed to include subscription status
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req: express.Request, res: express.Response) => {
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

    const { email, password } = req.body;

    // Find user with subscription status
    const result = await pool.query(
      `SELECT id, email, username, password, role, subscription_tier, 
              subscription_status, created_at, updated_at 
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    const user = result.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Generate tokens with consistent payload
    const payload: JWTPayload = {
      userId: String(user.id),
      email: String(user.email),
      role: String(user.role),
      subscriptionTier: String(user.subscription_tier || 'free')
    };

    const token = jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: String(user.id), type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN } as SignOptions
    );

    // Check if payment is required
    const requiresPayment = user.subscription_status === 'pending' && user.subscription_tier !== 'free';

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          subscriptionTier: user.subscription_tier,
          subscriptionStatus: user.subscription_status || 'active',
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        token,
        refreshToken,
        requiresPayment: requiresPayment,
        message: requiresPayment ? 'Please complete payment to activate your account.' : 'Login successful'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Login failed',
        code: 'LOGIN_ERROR',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      }
    });
  }
});

// Get current user - FIXED VERSION
router.get('/me', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user!.userId;
    
    // Get user from database with all necessary fields
    const result = await pool.query(`
      SELECT id, email, username, role, subscription_tier, subscription_status,
             profile_image, stripe_customer_id, referral_code, referred_by,
             created_at, updated_at 
      FROM users WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found', code: 'USER_NOT_FOUND' }
      });
    }
    
    const user = result.rows[0];
    
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
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch user data', code: 'FETCH_USER_ERROR' }
    });
  }
});

// Refresh token endpoint
router.post('/refresh-token', [
  body('refreshToken').notEmpty()
], async (req: express.Request, res: express.Response) => {
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

    const { refreshToken } = req.body;

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      
      // Get user info
      const result = await pool.query(
        `SELECT id, email, username, role, subscription_tier, subscription_status 
         FROM users WHERE id = $1`,
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid refresh token',
            code: 'INVALID_REFRESH_TOKEN'
          }
        });
      }

      const user = result.rows[0];

      // Generate new access token with consistent payload
      const payload: JWTPayload = {
        userId: String(user.id),
        email: String(user.email),
        role: String(user.role),
        subscriptionTier: String(user.subscription_tier || 'free')
      };

      const newToken = jwt.sign(
        payload,
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as SignOptions
      );

      res.json({
        success: true,
        data: {
          token: newToken,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            subscriptionTier: user.subscription_tier,
            subscriptionStatus: user.subscription_status
          }
        }
      });

    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        }
      });
    }

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Token refresh failed',
        code: 'REFRESH_TOKEN_ERROR'
      }
    });
  }
});

// Logout endpoint
router.post('/logout', (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
});

export default router;