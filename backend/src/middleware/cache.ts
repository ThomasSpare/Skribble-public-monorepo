// backend/src/middleware/cache.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import redisCacheService from '../services/redis-cache';

// Cache middleware factory
export const cacheMiddleware = (ttl: number = 600) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL, query params, and user
    const userId = (req as any).user?.userId || 'anonymous';
    const cacheKey = generateCacheKey(req.originalUrl, req.query, userId);

    try {
      // Try to get from cache
      const cachedResult = await redisCacheService.get(cacheKey);
      
      if (cachedResult) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.json(cachedResult);
      }

      console.log(`❌ Cache MISS: ${cacheKey}`);

      // Store original res.json method
      const originalJson = res.json;

      // Override res.json to cache the response
      res.json = function(data: any) {
        // Cache successful responses only
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisCacheService.set(cacheKey, data, ttl).catch(err => {
            console.error('❌ Failed to cache response:', err);
          });
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ Cache middleware error:', error);
      next(); // Continue without caching on error
    }
  };
};

// Generate consistent cache key
function generateCacheKey(url: string, query: any, userId: string): string {
  const queryString = Object.keys(query)
    .sort()
    .map(key => `${key}=${query[key]}`)
    .join('&');
  
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  const content = `${fullUrl}:${userId}`;
  
  return `cache:${crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)}`;
}

// Project-specific cache middleware
export const projectCacheMiddleware = (ttl: number = 1800) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const projectId = req.params.id || req.params.projectId;
    if (!projectId) return next();

    try {
      const cachedProject = await redisCacheService.getProject(projectId);
      
      if (cachedProject) {
        console.log(`✅ Project cache HIT: ${projectId}`);
        return res.json({
          success: true,
          data: cachedProject
        });
      }

      console.log(`❌ Project cache MISS: ${projectId}`);

      const originalJson = res.json;
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
          redisCacheService.setProject(projectId, data.data, ttl).catch(err => {
            console.error('❌ Failed to cache project:', err);
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ Project cache middleware error:', error);
      next();
    }
  };
};

// Waveform cache middleware
export const waveformCacheMiddleware = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const audioFileId = req.params.audioFileId;
    const zoomLevel = req.query.zoom ? parseFloat(req.query.zoom as string) : undefined;

    if (!audioFileId) return next();

    try {
      const cachedWaveform = await redisCacheService.getWaveform(audioFileId, zoomLevel);
      
      if (cachedWaveform) {
        console.log(`✅ Waveform cache HIT: ${audioFileId}${zoomLevel ? `:${zoomLevel}` : ''}`);
        return res.json({
          success: true,
          data: { waveformData: cachedWaveform }
        });
      }

      console.log(`❌ Waveform cache MISS: ${audioFileId}${zoomLevel ? `:${zoomLevel}` : ''}`);

      const originalJson = res.json;
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data?.waveformData) {
          redisCacheService.setWaveform(
            audioFileId, 
            data.data.waveformData, 
            zoomLevel
          ).catch(err => {
            console.error('❌ Failed to cache waveform:', err);
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ Waveform cache middleware error:', error);
      next();
    }
  };
};

// Cache invalidation middleware (for POST/PUT/DELETE)
export const invalidateCacheMiddleware = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(data: any) {
      // Only invalidate on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => {
          // Replace placeholders with actual values
          let resolvedPattern = pattern;
          
          // Replace :projectId with actual project ID
          if (req.params.projectId || req.params.id) {
            resolvedPattern = resolvedPattern.replace(':projectId', req.params.projectId || req.params.id);
          }
          
          // Replace :userId with actual user ID
          if ((req as any).user?.userId) {
            resolvedPattern = resolvedPattern.replace(':userId', (req as any).user.userId);
          }

          redisCacheService.invalidatePattern(resolvedPattern).catch(err => {
            console.error('❌ Failed to invalidate cache pattern:', resolvedPattern, err);
          });
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

// User stats cache middleware
export const userStatsCacheMiddleware = (ttl: number = 3600) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const userId = (req as any).user?.userId;
    if (!userId) return next();

    try {
      const cachedStats = await redisCacheService.getUserStats(userId);
      
      if (cachedStats) {
        console.log(`✅ User stats cache HIT: ${userId}`);
        return res.json({
          success: true,
          data: cachedStats
        });
      }

      console.log(`❌ User stats cache MISS: ${userId}`);

      const originalJson = res.json;
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
          redisCacheService.setUserStats(userId, data.data, ttl).catch(err => {
            console.error('❌ Failed to cache user stats:', err);
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ User stats cache middleware error:', error);
      next();
    }
  };
};

// Annotations cache middleware
export const annotationsCacheMiddleware = (ttl: number = 900) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const audioFileId = req.params.audioFileId;
    const userId = (req as any).user?.userId;
    
    if (!audioFileId || !userId) return next();

    // Generate cache key including query params for filtering
    const queryParams = new URLSearchParams();
    if (req.query.status) queryParams.set('status', req.query.status as string);
    if (req.query.priority) queryParams.set('priority', req.query.priority as string);
    if (req.query.type) queryParams.set('type', req.query.type as string);
    if (req.query.limit) queryParams.set('limit', req.query.limit as string);
    if (req.query.offset) queryParams.set('offset', req.query.offset as string);
    
    const queryString = queryParams.toString();
    const cacheKey = `annotations:${audioFileId}:${userId}${queryString ? `:${queryString}` : ''}`;

    try {
      const cachedAnnotations = await redisCacheService.get(cacheKey);
      
      if (cachedAnnotations) {
        console.log(`✅ Annotations cache HIT: ${cacheKey}`);
        return res.json(cachedAnnotations);
      }

      console.log(`❌ Annotations cache MISS: ${cacheKey}`);

      const originalJson = res.json;
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
          redisCacheService.set(cacheKey, data, ttl).catch(err => {
            console.error('❌ Failed to cache annotations:', err);
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ Annotations cache middleware error:', error);
      next();
    }
  };
};

// User subscription cache middleware
export const userSubscriptionCacheMiddleware = (ttl: number = 1800) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const userId = (req as any).user?.userId;
    if (!userId) return next();

    const cacheKey = `user:subscription:${userId}`;

    try {
      const cachedSubscription = await redisCacheService.get(cacheKey);
      
      if (cachedSubscription) {
        console.log(`✅ User subscription cache HIT: ${userId}`);
        return res.json(cachedSubscription);
      }

      console.log(`❌ User subscription cache MISS: ${userId}`);

      const originalJson = res.json;
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisCacheService.set(cacheKey, data, ttl).catch(err => {
            console.error('❌ Failed to cache user subscription:', err);
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ User subscription cache middleware error:', error);
      next();
    }
  };
};