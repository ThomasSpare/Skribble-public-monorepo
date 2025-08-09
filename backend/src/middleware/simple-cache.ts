// backend/src/middleware/simple-cache.ts
import { Request, Response, NextFunction } from 'express';
import redisService from '../services/redis-service';

// Simple cache middleware for waveform endpoints
export const cacheWaveform = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const audioFileId = req.params.audioFileId;
    const zoomLevel = req.query.zoom ? parseFloat(req.query.zoom as string) : undefined;

    if (!audioFileId) return next();

    try {
      // Try to get from cache
      const cachedWaveform = await redisService.getWaveform(audioFileId, zoomLevel);
      
      if (cachedWaveform) {
        console.log(`✅ Waveform cache HIT: ${audioFileId}${zoomLevel ? `:${zoomLevel}` : ''}`);
        return res.json({
          success: true,
          data: { 
            waveformData: cachedWaveform,
            cached: true,
            timestamp: new Date()
          }
        });
      }

      console.log(`❌ Waveform cache MISS: ${audioFileId}${zoomLevel ? `:${zoomLevel}` : ''}`);

      // Intercept the response to cache it
      const originalJson = res.json;
      res.json = function(data: any) {
        // Cache successful waveform responses
        if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data?.waveformData) {
          redisService.cacheWaveform(
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

// Simple cache middleware for projects
export const cacheProject = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const projectId = req.params.id || req.params.projectId;
    if (!projectId) return next();

    try {
      // Try to get from cache
      const cachedProject = await redisService.getProject(projectId);
      
      if (cachedProject) {
        console.log(`✅ Project cache HIT: ${projectId}`);
        return res.json({
          success: true,
          data: cachedProject
        });
      }

      console.log(`❌ Project cache MISS: ${projectId}`);

      // Intercept response to cache it
      const originalJson = res.json;
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data) {
          redisService.cacheProject(projectId, data.data).catch(err => {
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

// Cache invalidation for updates
export const invalidateCache = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(data: any) {
      // Only invalidate on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => {
          let resolvedPattern = pattern;
          
          // Replace placeholders
          if (req.params.projectId || req.params.id) {
            resolvedPattern = resolvedPattern.replace(':projectId', req.params.projectId || req.params.id);
          }
          
          if (req.params.audioFileId) {
            resolvedPattern = resolvedPattern.replace(':audioFileId', req.params.audioFileId);
          }

          redisService.invalidatePattern(resolvedPattern).catch(err => {
            console.error('❌ Failed to invalidate cache:', err);
          });
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};