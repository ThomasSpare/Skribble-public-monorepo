// backend/src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

interface CustomError extends Error {
  message: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
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

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      userId: decoded.userId,
      email: decoded.email
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
    
    return res.status(403).json({
      success: false,
      error: {
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      req.user = {
        userId: decoded.userId,
        email: decoded.email
      };
    } catch (error) {
      // Don't fail for optional auth, just continue without user
      console.error('Optional token verification error:', error);
    }
  }
  
  next();
};