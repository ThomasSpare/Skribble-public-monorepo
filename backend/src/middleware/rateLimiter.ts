import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';

const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000,
});

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Fix: Handle undefined req.ip with fallback
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    await rateLimiter.consume(clientIP);
    next();
  } catch (rejRes) {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    });
  }
};

export { rateLimiterMiddleware as rateLimiter };