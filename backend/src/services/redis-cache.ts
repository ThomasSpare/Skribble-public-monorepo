// backend/src/services/redis-cache.ts
import Redis from 'ioredis';

class RedisCacheService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.log('🔴 Redis connection closed');
      this.isConnected = false;
    });
  }

  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
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
      }
    } catch (error) {
      console.error('❌ Redis invalidate pattern error:', error);
    }
  }

  // Waveform-specific caching
  async getWaveform(audioFileId: string, zoomLevel?: number): Promise<number[] | null> {
    const key = zoomLevel 
      ? `waveform:${audioFileId}:zoom:${zoomLevel}`
      : `waveform:${audioFileId}:full`;
    
    return this.get<number[]>(key);
  }

  async setWaveform(
    audioFileId: string, 
    waveformData: number[], 
    zoomLevel?: number,
    ttl: number = 7200 // 2 hours
  ): Promise<void> {
    const key = zoomLevel 
      ? `waveform:${audioFileId}:zoom:${zoomLevel}`
      : `waveform:${audioFileId}:full`;
    
    await this.set(key, waveformData, ttl);
  }

  async invalidateWaveformCache(audioFileId: string): Promise<void> {
    await this.invalidatePattern(`waveform:${audioFileId}:*`);
  }

  // Project-specific caching
  async getProject(projectId: string): Promise<any | null> {
    return this.get(`project:${projectId}`);
  }

  async setProject(projectId: string, projectData: any, ttl: number = 1800): Promise<void> {
    await this.set(`project:${projectId}`, projectData, ttl);
  }

  async invalidateProjectCache(projectId: string): Promise<void> {
    await this.invalidatePattern(`project:${projectId}*`);
    await this.invalidatePattern(`annotations:${projectId}*`);
  }

  // User session caching
  async getUserSession(userId: string): Promise<any | null> {
    return this.get(`session:${userId}`);
  }

  async setUserSession(userId: string, sessionData: any, ttl: number = 3600): Promise<void> {
    await this.set(`session:${userId}`, sessionData, ttl);
  }

  // Annotations caching
  async getAnnotations(projectId: string): Promise<any[] | null> {
    return this.get(`annotations:${projectId}`);
  }

  async setAnnotations(projectId: string, annotations: any[], ttl: number = 1800): Promise<void> {
    await this.set(`annotations:${projectId}`, annotations, ttl);
  }

  // Query result caching
  async getQueryResult(queryHash: string): Promise<any | null> {
    return this.get(`query:${queryHash}`);
  }

  async setQueryResult(queryHash: string, result: any, ttl: number = 600): Promise<void> {
    await this.set(`query:${queryHash}`, result, ttl);
  }

  // Real-time collaboration data
  async setUserPresence(projectId: string, userId: string, presence: any): Promise<void> {
    const key = `presence:${projectId}:${userId}`;
    await this.set(key, presence, 300); // 5 minutes
  }

  async getUsersPresence(projectId: string): Promise<any[]> {
    try {
      const keys = await this.redis.keys(`presence:${projectId}:*`);
      const presenceData = [];
      
      for (const key of keys) {
        const data = await this.get(key);
        if (data) presenceData.push(data);
      }
      
      return presenceData;
    } catch (error) {
      console.error('❌ Error getting users presence:', error);
      return [];
    }
  }

  // Stats and analytics caching
  async getUserStats(userId: string): Promise<any | null> {
    return this.get(`stats:user:${userId}`);
  }

  async setUserStats(userId: string, stats: any, ttl: number = 3600): Promise<void> {
    await this.set(`stats:user:${userId}`, stats, ttl);
  }

  async getProjectStats(projectId: string): Promise<any | null> {
    return this.get(`stats:project:${projectId}`);
  }

  async setProjectStats(projectId: string, stats: any, ttl: number = 1800): Promise<void> {
    await this.set(`stats:project:${projectId}`, stats, ttl);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

export const redisCacheService = new RedisCacheService();
export default redisCacheService;