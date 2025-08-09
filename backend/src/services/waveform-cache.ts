// backend/src/services/waveform-cache.ts
import redisCacheService from './redis-cache';
import pool from '../config/database';

export interface WaveformCacheEntry {
  audioFileId: string;
  zoomLevel?: number;
  waveformData: number[];
  duration: number;
  sampleRate: number;
  generatedAt: Date;
}

export class WaveformCacheService {
  // Generate multiple zoom levels for smooth interaction
  static readonly ZOOM_LEVELS = [1, 2, 4, 8, 16, 32, 64];
  
  // Cache waveform with multiple zoom levels
  static async cacheWaveformWithZoomLevels(
    audioFileId: string,
    fullWaveformData: number[],
    duration: number,
    sampleRate: number = 44100
  ): Promise<void> {
    try {
      console.log(`🎵 Caching waveform with zoom levels for: ${audioFileId}`);

      // Cache full resolution waveform
      await redisCacheService.setWaveform(audioFileId, fullWaveformData);

      // Generate and cache downsampled versions for different zoom levels
      for (const zoomLevel of this.ZOOM_LEVELS) {
        if (zoomLevel === 1) continue; // Skip 1x, already cached above

        const downsampledData = this.downsampleWaveform(fullWaveformData, zoomLevel);
        await redisCacheService.setWaveform(audioFileId, downsampledData, zoomLevel);
      }

      // Also store metadata
      const metadata = {
        duration,
        sampleRate,
        originalSamples: fullWaveformData.length,
        generatedAt: new Date()
      };

      await redisCacheService.set(
        `waveform:meta:${audioFileId}`,
        metadata,
        7200 // 2 hours
      );

      console.log(`✅ Waveform cached for all zoom levels: ${audioFileId}`);
    } catch (error) {
      console.error('❌ Error caching waveform with zoom levels:', error);
      throw error;
    }
  }

  // Get optimal waveform for zoom level
  static async getOptimalWaveform(
    audioFileId: string,
    requestedZoomLevel: number = 1
  ): Promise<number[] | null> {
    try {
      // Find the best cached zoom level (closest but not smaller)
      const optimalZoomLevel = this.findOptimalZoomLevel(requestedZoomLevel);
      
      console.log(`🔍 Requesting waveform for ${audioFileId} at zoom ${requestedZoomLevel}, using cached zoom ${optimalZoomLevel}`);

      let waveformData = await redisCacheService.getWaveform(audioFileId, optimalZoomLevel);

      if (waveformData) {
        // If we got a higher resolution than needed, downsample it
        if (optimalZoomLevel < requestedZoomLevel) {
          const downsampleFactor = requestedZoomLevel / optimalZoomLevel;
          waveformData = this.downsampleWaveform(waveformData, downsampleFactor);
        }

        console.log(`✅ Waveform cache hit for ${audioFileId}:${optimalZoomLevel}`);
        return waveformData;
      }

      console.log(`❌ Waveform cache miss for ${audioFileId}:${optimalZoomLevel}`);
      return null;
    } catch (error) {
      console.error('❌ Error getting optimal waveform:', error);
      return null;
    }
  }

  // Generate waveform from audio file and cache it
  static async generateAndCacheWaveform(audioFileId: string): Promise<number[] | null> {
    try {
      // First check if already cached
      const cached = await redisCacheService.getWaveform(audioFileId);
      if (cached) {
        return cached;
      }

      // Get audio file info from database
      const result = await pool.query(
        'SELECT filename, s3_key, storage_type, duration FROM audio_files WHERE id = $1',
        [audioFileId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Audio file not found: ${audioFileId}`);
      }

      const audioFile = result.rows[0];
      
      // Generate waveform using FFmpeg (you'll need to implement this)
      const waveformData = await this.generateWaveformWithFFmpeg(audioFile);

      if (waveformData) {
        // Cache with all zoom levels
        await this.cacheWaveformWithZoomLevels(
          audioFileId,
          waveformData,
          audioFile.duration
        );

        return waveformData;
      }

      return null;
    } catch (error) {
      console.error('❌ Error generating and caching waveform:', error);
      return null;
    }
  }

  // Downsample waveform data for different zoom levels
  private static downsampleWaveform(data: number[], factor: number): number[] {
    if (factor <= 1) return data;

    const outputLength = Math.ceil(data.length / factor);
    const result: number[] = new Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const startIdx = Math.floor(i * factor);
      const endIdx = Math.min(startIdx + Math.floor(factor), data.length);
      
      // Use RMS for better visual representation
      let sum = 0;
      let count = 0;
      
      for (let j = startIdx; j < endIdx; j++) {
        sum += data[j] * data[j];
        count++;
      }
      
      result[i] = count > 0 ? Math.sqrt(sum / count) : 0;
    }

    return result;
  }

  // Find the optimal cached zoom level
  private static findOptimalZoomLevel(requestedZoom: number): number {
    // Find the smallest cached zoom level that's >= requested zoom
    const availableZoomLevels = [1, ...this.ZOOM_LEVELS].sort((a, b) => a - b);
    
    for (const zoom of availableZoomLevels) {
      if (zoom >= requestedZoom) {
        return zoom;
      }
    }
    
    // If requested zoom is higher than our max, use the highest available
    return availableZoomLevels[availableZoomLevels.length - 1];
  }

  // Generate waveform using FFmpeg (placeholder - you'll need to implement this)
  private static async generateWaveformWithFFmpeg(audioFile: any): Promise<number[] | null> {
    // This is a placeholder implementation
    // You'll need to implement actual FFmpeg waveform generation
    // For now, return a mock waveform
    console.log('🔧 Generating waveform with FFmpeg for:', audioFile.filename);
    
    // Mock waveform data (replace with actual FFmpeg implementation)
    const duration = audioFile.duration || 180;
    const sampleCount = Math.floor(duration * 50); // 50 samples per second
    const mockWaveform = Array.from({ length: sampleCount }, (_, i) => {
      return Math.abs(Math.sin(i * 0.1) * Math.random() * 0.8 + 0.2);
    });
    
    return mockWaveform;
  }

  // Get waveform metadata
  static async getWaveformMetadata(audioFileId: string): Promise<any | null> {
    try {
      return await redisCacheService.get(`waveform:meta:${audioFileId}`);
    } catch (error) {
      console.error('❌ Error getting waveform metadata:', error);
      return null;
    }
  }

  // Invalidate all waveform cache for audio file
  static async invalidateWaveform(audioFileId: string): Promise<void> {
    try {
      await redisCacheService.invalidateWaveformCache(audioFileId);
      await redisCacheService.del(`waveform:meta:${audioFileId}`);
      console.log(`✅ Invalidated waveform cache for: ${audioFileId}`);
    } catch (error) {
      console.error('❌ Error invalidating waveform cache:', error);
    }
  }

  // Preload waveforms for a project
  static async preloadProjectWaveforms(projectId: string): Promise<void> {
    try {
      console.log(`🚀 Preloading waveforms for project: ${projectId}`);

      const result = await pool.query(
        'SELECT id FROM audio_files WHERE project_id = $1',
        [projectId]
      );

      const audioFileIds = result.rows.map(row => row.id);

      // Generate waveforms in parallel (but limit concurrency)
      const concurrency = 3;
      for (let i = 0; i < audioFileIds.length; i += concurrency) {
        const batch = audioFileIds.slice(i, i + concurrency);
        await Promise.all(
          batch.map(audioFileId => this.generateAndCacheWaveform(audioFileId))
        );
      }

      console.log(`✅ Preloaded waveforms for ${audioFileIds.length} files in project ${projectId}`);
    } catch (error) {
      console.error('❌ Error preloading project waveforms:', error);
    }
  }
}