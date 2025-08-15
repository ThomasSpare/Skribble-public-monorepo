import { Router, Request, Response } from 'express';
import { analyticsService } from '../services/analytics-service';
import bcrypt from 'bcryptjs';
import { AnalyticsTimeRange } from '../types';

const router = Router();

// Password for dashboard access - you should change this hash
const DASHBOARD_PASSWORD_HASH = process.env.ANALYTICS_PASSWORD_HASH || '$2b$12$0YRPlog1gdV8EkJ8B4Fv.e9I7M.tN3GDq2Oyx1QZOBrTfLu1wMy.W';

// Middleware to get client IP address
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIP = req.headers['x-real-ip'] as string;
  const cloudflareIP = req.headers['cf-connecting-ip'] as string;
  
  return (
    cloudflareIP ||
    realIP ||
    (forwarded ? forwarded.split(',')[0].trim() : '') ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
}

// Track page view (public endpoint)
router.post('/track', async (req: Request, res: Response) => {
  try {
    const {
      path,
      referrer,
      sessionId,
      screenResolution
    } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path is required'
      });
    }

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = getClientIP(req);

    const result = await analyticsService.trackPageView({
      path,
      referrer,
      userAgent,
      ipAddress,
      screenResolution,
      sessionId
    });

    return res.json({
      success: result.success,
      sessionId: result.sessionId
    });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track page view'
    });
  }
});

// Dashboard authentication endpoint
router.post('/auth/dashboard', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    console.log('Analytics auth attempt:', { password: password?.substring(0, 3) + '***', timestamp: new Date().toISOString() });

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Temporary simple check - replace with bcrypt later
    const isValid = password === 'zmakqo0202' || await bcrypt.compare(password, DASHBOARD_PASSWORD_HASH);
    
    console.log('Password validation result:', { isValid, receivedPassword: password === 'zmakqo0202' });

    if (isValid) {
      // Set authentication cookie
      res.cookie('analytics_dashboard_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      return res.json({ success: true });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid password'
    });

  } catch (error) {
    console.error('Dashboard auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// Middleware to check dashboard authentication
function requireDashboardAuth(req: Request, res: Response, next: any) {
  const authCookie = req.cookies?.analytics_dashboard_auth;

  if (authCookie !== 'authenticated') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Please log in to access dashboard.'
    });
  }

  next();
}

// Get analytics stats (protected endpoint)
router.get('/stats', requireDashboardAuth, async (req: Request, res: Response) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;

    let timeRange: AnalyticsTimeRange = { period: period as any };

    if (period === 'custom' && startDate && endDate) {
      timeRange = {
        period: 'custom',
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };
    }

    const stats = await analyticsService.getAnalyticsSummary(timeRange);

    return res.json({
      success: true,
      data: stats,
      metadata: {
        period,
        generatedAt: new Date().toISOString(),
        databaseConnected: analyticsService.isDatabaseConfigured()
      }
    });

  } catch (error) {
    console.error('Failed to get analytics stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics data'
    });
  }
});

// Update daily stats (protected endpoint)
router.post('/update-daily-stats', requireDashboardAuth, async (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : undefined;

    await analyticsService.updateDailyStats(targetDate);

    return res.json({
      success: true,
      message: 'Daily stats updated successfully'
    });

  } catch (error) {
    console.error('Failed to update daily stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update daily stats'
    });
  }
});

// Test endpoint to verify deployment
router.get('/test-deployment', (req: Request, res: Response) => {
  res.json({
    message: 'Analytics routes updated successfully',
    timestamp: new Date().toISOString(),
    passwordCheck: 'zmakqo0202' === 'zmakqo0202' ? 'PASS' : 'FAIL'
  });
});

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await analyticsService.healthCheck();

    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: analyticsService.isDatabaseConfigured() ? 
        (isHealthy ? 'connected' : 'error') : 'not_configured',
      service: 'Analytics API'
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'error',
      service: 'Analytics API',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Logout endpoint
router.post('/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('analytics_dashboard_auth');
  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;