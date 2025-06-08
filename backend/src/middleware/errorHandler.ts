import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  // Default error
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';

  // Custom error handling
  if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code || 'CUSTOM_ERROR';
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
  }

  // Database errors
  if (error.code === '23505') { // PostgreSQL unique violation
    statusCode = 400;
    message = 'Resource already exists';
    code = 'DUPLICATE_RESOURCE';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
};