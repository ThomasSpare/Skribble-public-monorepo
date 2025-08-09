// backend/src/services/redis-service.ts
import Redis from 'ioredis';

class RedisService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
    
    this.redis = new Redis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error.message);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.log('🔴 Redis connection closed');
      this.isConnected = false;
    });
  }

  // Basic cache operations
  async get(key: string): Promise<any | null> {
    if (!this.isConnected) return null;
    
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('❌ Redis GET error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      console.log(`✅ Cached: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error('❌ Redis SET error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      await this.redis.del(key);
      console.log(`🗑️ Deleted cache: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Redis DEL error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🧹 Invalidated ${keys.length} cache entries: ${pattern}`);
      }
    } catch (error) {
      console.error('❌ Redis invalidate pattern error:', error);
    }
  }

  // Waveform-specific methods
  async cacheWaveform(audioFileId: string, waveformData: number[], zoomLevel?: number): Promise<void> {
    const key = zoomLevel 
      ? `waveform:${audioFileId}:zoom:${zoomLevel}`
      : `waveform:${audioFileId}:full`;
    
    await this.set(key, waveformData, 7200); // Cache for 2 hours
  }

  async getWaveform(audioFileId: string, zoomLevel?: number): Promise<number[] | null> {
    const key = zoomLevel 
      ? `waveform:${audioFileId}:zoom:${zoomLevel}`
      : `waveform:${audioFileId}:full`;
    
    return this.get(key);
  }

  async invalidateWaveform(audioFileId: string): Promise<void> {
    await this.invalidatePattern(`waveform:${audioFileId}:*`);
  }

  // Project-specific methods
  async cacheProject(projectId: string, projectData: any): Promise<void> {
    await this.set(`project:${projectId}`, projectData, 1800); // Cache for 30 minutes
  }

  async getProject(projectId: string): Promise<any | null> {
    return this.get(`project:${projectId}`);
  }

  async invalidateProject(projectId: string): Promise<void> {
    await this.invalidatePattern(`project:${projectId}*`);
    await this.invalidatePattern(`annotations:${projectId}*`);
  }

  // Annotations cache
  async cacheAnnotations(projectId: string, annotations: any[]): Promise<void> {
    await this.set(`annotations:${projectId}`, annotations, 900); // Cache for 15 minutes
  }

  async getAnnotations(projectId: string): Promise<any[] | null> {
    return this.get(`annotations:${projectId}`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  // Debug info
  getConnectionInfo(): { connected: boolean; url: string } {
    return {
      connected: this.isConnected,
      url: process.env.REDIS_URL || 'redis://localhost:6380'
    };
  }
}

// Export singleton instance
export const redisService = new RedisService();
export default redisService;