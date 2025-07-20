// backend/src/middleware/auth.ts - Updated with Guest Account Support
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Extended user interface that includes guest account info
interface AuthUser {
  userId: string;
  email: string;
  role?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  isGuest?: boolean;
  expiresAt?: Date;
}

// Extend Request type to include comprehensive user info
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      guestCollaboration?: {
        role: string;
        permissions: any;
        guest_project_id?: string;
      };
    }
  }
}

interface CustomError extends Error {
  message: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Access token required',
          code: 'TOKEN_REQUIRED'
        }
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as any;
    
    // Create comprehensive user object with all possible fields
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      subscriptionTier: decoded.subscriptionTier,
      subscriptionStatus: decoded.subscriptionStatus,
      isGuest: decoded.isGuest || false,
      expiresAt: decoded.expiresAt ? new Date(decoded.expiresAt) : undefined
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    // Handle specific JWT errors
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        }
      });
    }
    
    return res.status(403).json({
      success: false,
      error: {
        message: 'Token verification failed',
        code: 'TOKEN_VERIFICATION_FAILED'
      }
    });
  }
};

// Optional middleware for routes that work with or without auth
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as any;
      
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        subscriptionTier: decoded.subscriptionTier,
        subscriptionStatus: decoded.subscriptionStatus,
        isGuest: decoded.isGuest || false,
        expiresAt: decoded.expiresAt ? new Date(decoded.expiresAt) : undefined
      };
    } catch (error) {
      // Don't fail for optional auth, just continue without user
      console.log('Optional token verification failed:', error);
    }
  }
  
  next();
};

// Middleware specifically for checking if user is authenticated and not expired guest
export const requireValidAuth = (req: Request, res: Response, next: NextFunction) => {
  // First run normal auth
  authenticateToken(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    // Check if guest account has expired
    if (req.user.isGuest && req.user.expiresAt && req.user.expiresAt < new Date()) {
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
  });
};