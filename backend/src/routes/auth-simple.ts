// backend/src/routes/auth-basic.ts
import express from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { profile } from 'console';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Full auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).trim(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['producer', 'artist', 'both'])
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

    const { email, username, password, role } = req.body;

    // Check if user already exists - DIRECT DATABASE QUERY
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

    // Check if username is taken - DIRECT DATABASE QUERY  
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

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user - DIRECT DATABASE QUERY
    const userId = uuidv4();
    const now = new Date();
    
    const result = await pool.query(`
      INSERT INTO users (id, email, username, password, role, subscription_tier, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, username, role, subscription_tier, created_at, updated_at
    `, [userId, email, username, hashedPassword, role, 'free', now, now]);

    const user = result.rows[0];

    // Generate tokens
    const tokenOptions: SignOptions = { 
      expiresIn: process.env.JWT_EXPIRES_IN ? Number(process.env.JWT_EXPIRES_IN.replace('h', '')) * 3600 : 3600 
    };
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || '',
      tokenOptions
    );

    const refreshTokenOptions: SignOptions = { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ? Number(process.env.JWT_REFRESH_EXPIRES_IN.replace('d', '')) * 86400 : 604800 
    };
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET || '',
      refreshTokenOptions
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
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        token,
        refreshToken
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

// Login
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

    // Find user - DIRECT DATABASE QUERY
    const result = await pool.query(
      'SELECT id, email, username, password, role, subscription_tier, created_at, updated_at FROM users WHERE email = $1',
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

    // Generate tokens
    const tokenOptions: SignOptions = { 
      expiresIn: process.env.JWT_EXPIRES_IN ? Number(process.env.JWT_EXPIRES_IN.replace('h', '')) * 3600 : 3600 
    };
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || '',
      tokenOptions
    );

    const refreshTokenOptions: SignOptions = { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ? Number(process.env.JWT_REFRESH_EXPIRES_IN.replace('d', '')) * 86400 : 604800 
    };
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET || '',
      refreshTokenOptions
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          subscriptionTier: user.subscription_tier,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        token,
        refreshToken
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

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No token provided', code: 'NO_TOKEN' }
      });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const result = await pool.query(
      'SELECT id, email, username, profile_image, role, subscription_tier, created_at, updated_at FROM users WHERE id = $1',
      [decoded.userId]
    );
    
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
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        profileImage: user.profile_image || null
      }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({
      success: false,
      error: { message: 'Invalid token', code: 'INVALID_TOKEN' }
    });
  }
});

export default router;