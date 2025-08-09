import { Pool } from 'pg';
import geoip from 'geoip-lite';
import { v4 as uuidv4 } from 'uuid';
import { 
  PageView, 
  AnalyticsSession, 
  AnalyticsSummary,
  CountryStat,
  PageStat,
  ReferrerStat,
  DeviceStat,
  BrowserStat,
  DailyStat,
  AnalyticsTimeRange 
} from '../../../shared/types';

class AnalyticsService {
  private pool: Pool;
  private isInitialized = false;

  constructor() {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not found. Analytics features will be disabled.');
      return;
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || !this.pool) return;

    try {
      await this.pool.query('SELECT 1'); // Test connection
      this.isInitialized = true;
      console.log('✅ Analytics service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize analytics service:', error);
      throw error;
    }
  }

  private parseUserAgent(userAgent: string): { browser: string; os: string; deviceType: 'desktop' | 'mobile' | 'tablet' } {
    const ua = userAgent.toLowerCase();
    
    // Browser detection
    let browser = 'Unknown';
    if (ua.includes('chrome') && !ua.includes('edge')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    // OS detection
    let os = 'Unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios')) os = 'iOS';

    // Device type detection
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (ua.includes('mobile')) deviceType = 'mobile';
    else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';

    return { browser, os, deviceType };
  }

  private getLocationFromIP(ipAddress: string): { country?: string; city?: string } {
    try {
      const geo = geoip.lookup(ipAddress);
      return {
        country: geo?.country || undefined,
        city: geo?.city || undefined
      };
    } catch (error) {
      console.warn('Failed to get location from IP:', error);
      return {};
    }
  }

  async trackPageView(data: {
    path: string;
    referrer?: string;
    userAgent: string;
    ipAddress: string;
    screenResolution?: string;
    sessionId?: string;
  }): Promise<{ sessionId: string; success: boolean }> {
    if (!this.pool) {
      return { sessionId: data.sessionId || 'fallback', success: true };
    }

    await this.initialize();

    const client = await this.pool.connect();
    try {
      // Parse user agent and get location
      const { browser, os, deviceType } = this.parseUserAgent(data.userAgent);
      const { country, city } = this.getLocationFromIP(data.ipAddress);

      // Get or create session
      const sessionResult = await client.query(
        'SELECT get_or_create_analytics_session($1, $2, $3) as session_id',
        [data.sessionId || uuidv4(), data.ipAddress, data.userAgent]
      );
      const sessionId = sessionResult.rows[0].session_id;

      // Check if unique visitor
      const uniqueResult = await client.query(
        'SELECT is_unique_visitor_today($1, $2) as is_unique',
        [data.ipAddress, data.userAgent]
      );
      const isUniqueVisitor = uniqueResult.rows[0].is_unique;

      // Insert page view
      await client.query(`
        INSERT INTO analytics_page_views (
          path, referrer, user_agent, ip_address, country, city,
          device_type, browser, os, screen_resolution, session_id, is_unique_visitor
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        data.path,
        data.referrer,
        data.userAgent,
        data.ipAddress,
        country,
        city,
        deviceType,
        browser,
        os,
        data.screenResolution,
        sessionId,
        isUniqueVisitor
      ]);

      return { sessionId, success: true };
    } catch (error) {
      console.error('Failed to track page view:', error);
      return { sessionId: data.sessionId || 'error', success: false };
    } finally {
      client.release();
    }
  }

  async getAnalyticsSummary(timeRange: AnalyticsTimeRange = { period: 'month' }): Promise<AnalyticsSummary> {
    if (!this.pool) {
      return this.getFallbackSummary();
    }

    await this.initialize();

    const client = await this.pool.connect();
    try {
      const { startDate, endDate } = this.getDateRange(timeRange);

      // Get basic stats
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_page_views,
          COUNT(DISTINCT CASE WHEN pv.is_unique_visitor THEN pv.ip_address || pv.user_agent END) as total_unique_visitors,
          AVG(
            CASE 
              WHEN s.duration > 0 THEN s.duration 
              ELSE EXTRACT(EPOCH FROM (s.updated_at - s.created_at))
            END
          )::INTEGER as avg_session_duration
        FROM analytics_page_views pv
        LEFT JOIN analytics_sessions s ON pv.session_id = s.id
        WHERE pv.timestamp >= $1 AND pv.timestamp <= $2
      `, [startDate, endDate]);

      const stats = statsResult.rows[0];
      const totalViews = parseInt(stats.total_page_views) || 0;
      const uniqueVisitors = parseInt(stats.total_unique_visitors) || 0;
      const avgSessionDuration = parseInt(stats.avg_session_duration) || 0;

      // Get daily stats
      const dailyStats = await this.getDailyStats(client, startDate, endDate);

      // Calculate average daily views
      const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const avgDailyViews = Math.round(totalViews / days);

      // Get top countries
      const topCountries = await this.getTopCountries(client, startDate, endDate);

      // Get top pages
      const topPages = await this.getTopPages(client, startDate, endDate);

      // Get top referrers
      const topReferrers = await this.getTopReferrers(client, startDate, endDate);

      // Get device breakdown
      const deviceBreakdown = await this.getDeviceBreakdown(client, startDate, endDate);

      // Get browser breakdown
      const browserBreakdown = await this.getBrowserBreakdown(client, startDate, endDate);

      return {
        totalPageViews: totalViews,
        totalUniqueVisitors: uniqueVisitors,
        avgDailyViews,
        avgSessionDuration,
        topCountries,
        topPages,
        topReferrers,
        deviceBreakdown,
        browserBreakdown,
        dailyStats
      };
    } catch (error) {
      console.error('Failed to get analytics summary:', error);
      return this.getFallbackSummary();
    } finally {
      client.release();
    }
  }

  private async getDailyStats(client: any, startDate: Date, endDate: Date): Promise<DailyStat[]> {
    const result = await client.query(`
      SELECT 
        timestamp::DATE as date,
        COUNT(*) as views,
        COUNT(DISTINCT CASE WHEN is_unique_visitor THEN ip_address || user_agent END) as unique_visitors,
        COUNT(DISTINCT session_id) as sessions
      FROM analytics_page_views
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY timestamp::DATE
      ORDER BY date
    `, [startDate, endDate]);

    return result.rows.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      views: parseInt(row.views),
      uniqueVisitors: parseInt(row.unique_visitors),
      sessions: parseInt(row.sessions)
    }));
  }

  private async getTopCountries(client: any, startDate: Date, endDate: Date): Promise<CountryStat[]> {
    const result = await client.query(`
      SELECT 
        COALESCE(country, 'Unknown') as country,
        COUNT(*) as views,
        COUNT(DISTINCT CASE WHEN is_unique_visitor THEN ip_address || user_agent END) as unique_visitors
      FROM analytics_page_views
      WHERE timestamp >= $1 AND timestamp <= $2 AND country IS NOT NULL
      GROUP BY country
      ORDER BY views DESC
      LIMIT 10
    `, [startDate, endDate]);

    const totalViews = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.views), 0);

    return result.rows.map((row: any) => ({
      country: row.country,
      views: parseInt(row.views),
      uniqueVisitors: parseInt(row.unique_visitors),
      percentage: totalViews > 0 ? Math.round((parseInt(row.views) / totalViews) * 100) : 0
    }));
  }

  private async getTopPages(client: any, startDate: Date, endDate: Date): Promise<PageStat[]> {
    const result = await client.query(`
      SELECT 
        path,
        COUNT(*) as views,
        COUNT(DISTINCT CASE WHEN pv.is_unique_visitor THEN pv.ip_address || pv.user_agent END) as unique_visitors,
        AVG(
          CASE 
            WHEN s.duration > 0 THEN s.duration 
            ELSE EXTRACT(EPOCH FROM (s.updated_at - s.created_at))
          END
        )::INTEGER as avg_time_on_page
      FROM analytics_page_views pv
      LEFT JOIN analytics_sessions s ON pv.session_id = s.id
      WHERE pv.timestamp >= $1 AND pv.timestamp <= $2
      GROUP BY path
      ORDER BY views DESC
      LIMIT 10
    `, [startDate, endDate]);

    return result.rows.map((row: any) => ({
      path: row.path,
      views: parseInt(row.views),
      uniqueVisitors: parseInt(row.unique_visitors),
      avgTimeOnPage: parseInt(row.avg_time_on_page) || 0
    }));
  }

  private async getTopReferrers(client: any, startDate: Date, endDate: Date): Promise<ReferrerStat[]> {
    const result = await client.query(`
      SELECT 
        COALESCE(referrer, 'Direct') as referrer,
        COUNT(*) as views
      FROM analytics_page_views
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY referrer
      ORDER BY views DESC
      LIMIT 10
    `, [startDate, endDate]);

    const totalViews = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.views), 0);

    return result.rows.map((row: any) => ({
      referrer: row.referrer,
      views: parseInt(row.views),
      percentage: totalViews > 0 ? Math.round((parseInt(row.views) / totalViews) * 100) : 0
    }));
  }

  private async getDeviceBreakdown(client: any, startDate: Date, endDate: Date): Promise<DeviceStat[]> {
    const result = await client.query(`
      SELECT 
        device_type,
        COUNT(*) as views
      FROM analytics_page_views
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY device_type
      ORDER BY views DESC
    `, [startDate, endDate]);

    const totalViews = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.views), 0);

    return result.rows.map((row: any) => ({
      deviceType: row.device_type as 'desktop' | 'mobile' | 'tablet',
      views: parseInt(row.views),
      percentage: totalViews > 0 ? Math.round((parseInt(row.views) / totalViews) * 100) : 0
    }));
  }

  private async getBrowserBreakdown(client: any, startDate: Date, endDate: Date): Promise<BrowserStat[]> {
    const result = await client.query(`
      SELECT 
        browser,
        COUNT(*) as views
      FROM analytics_page_views
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY browser
      ORDER BY views DESC
      LIMIT 10
    `, [startDate, endDate]);

    const totalViews = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.views), 0);

    return result.rows.map((row: any) => ({
      browser: row.browser,
      views: parseInt(row.views),
      percentage: totalViews > 0 ? Math.round((parseInt(row.views) / totalViews) * 100) : 0
    }));
  }

  private getDateRange(timeRange: AnalyticsTimeRange): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    let startDate: Date;

    switch (timeRange.period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        startDate = timeRange.startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate.setTime(timeRange.endDate?.getTime() || now.getTime());
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }

  private getFallbackSummary(): AnalyticsSummary {
    return {
      totalPageViews: 0,
      totalUniqueVisitors: 0,
      avgDailyViews: 0,
      avgSessionDuration: 0,
      topCountries: [],
      topPages: [],
      topReferrers: [],
      deviceBreakdown: [],
      browserBreakdown: [],
      dailyStats: []
    };
  }

  async updateDailyStats(date?: Date): Promise<void> {
    if (!this.pool) return;

    await this.initialize();

    const client = await this.pool.connect();
    try {
      const targetDate = date || new Date();
      await client.query('SELECT update_analytics_daily_stats($1)', [targetDate]);
      console.log(`✅ Daily stats updated for ${targetDate.toISOString().split('T')[0]}`);
    } catch (error) {
      console.error('Failed to update daily stats:', error);
    } finally {
      client.release();
    }
  }

  isDatabaseConfigured(): boolean {
    return !!process.env.DATABASE_URL && !!this.pool;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const result = await this.pool.query('SELECT 1');
      return result.rowCount === 1;
    } catch (error) {
      console.error('Analytics database health check failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log('Analytics service disconnected');
    }
  }
}

export const analyticsService = new AnalyticsService();