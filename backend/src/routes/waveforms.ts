// backend/src/routes/waveforms.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { waveformCacheMiddleware } from '../middleware/cache';
import { WaveformCacheService } from '../services/waveform-cache';
import pool from '../config/database';

const router = express.Router();

// Get waveform data with optimal caching
router.get(
  '/:audioFileId',
  authenticateToken,
  waveformCacheMiddleware(),
  async (req: any, res) => {
    try {
      const { audioFileId } = req.params;
      const zoomLevel = req.query.zoom ? parseFloat(req.query.zoom as string) : 1;
      const userId = req.user.userId;

      // Verify user has access to this audio file
      const accessQuery = `
        SELECT af.id 
        FROM audio_files af
        JOIN projects p ON af.project_id = p.id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE af.id = $1 
        AND (p.creator_id = $2 OR pc.user_id = $2)
      `;

      const accessResult = await pool.query(accessQuery, [audioFileId, userId]);
      
      if (accessResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied to audio file' }
        });
      }

      // Try to get optimal waveform from cache
      let waveformData = await WaveformCacheService.getOptimalWaveform(audioFileId, zoomLevel);

      if (!waveformData) {
        // Generate and cache if not found
        console.log(`🔄 Generating waveform for ${audioFileId}`);
        waveformData = await WaveformCacheService.generateAndCacheWaveform(audioFileId);
        
        if (!waveformData) {
          return res.status(500).json({
            success: false,
            error: { message: 'Failed to generate waveform' }
          });
        }

        // If we generated full waveform but need a specific zoom, get the optimal version
        if (zoomLevel !== 1) {
          waveformData = await WaveformCacheService.getOptimalWaveform(audioFileId, zoomLevel);
        }
      }

      // Get metadata
      const metadata = await WaveformCacheService.getWaveformMetadata(audioFileId);

      res.json({
        success: true,
        data: {
          waveformData,
          metadata: {
            samples: waveformData.length,
            zoomLevel,
            duration: metadata?.duration,
            sampleRate: metadata?.sampleRate,
            cached: true
          }
        }
      });

    } catch (error) {
      console.error('❌ Error getting waveform:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get waveform data' }
      });
    }
  }
);

// Preload waveforms for a project (for better UX)
router.post(
  '/preload/:projectId',
  authenticateToken,
  async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.userId;

      // Verify user has access to project
      const projectQuery = `
        SELECT p.id 
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE p.id = $1 
        AND (p.creator_id = $2 OR pc.user_id = $2)
      `;

      const projectResult = await pool.query(projectQuery, [projectId, userId]);
      
      if (projectResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied to project' }
        });
      }

      // Start preloading in background (don't wait for completion)
      WaveformCacheService.preloadProjectWaveforms(projectId).catch(error => {
        console.error('❌ Background waveform preload failed:', error);
      });

      res.json({
        success: true,
        message: 'Waveform preloading started'
      });

    } catch (error) {
      console.error('❌ Error starting waveform preload:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to start preload' }
      });
    }
  }
);

// Get waveform generation status
router.get(
  '/status/:audioFileId',
  authenticateToken,
  async (req: any, res) => {
    try {
      const { audioFileId } = req.params;
      const userId = req.user.userId;

      // Verify access
      const accessQuery = `
        SELECT af.id 
        FROM audio_files af
        JOIN projects p ON af.project_id = p.id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE af.id = $1 
        AND (p.creator_id = $2 OR pc.user_id = $2)
      `;

      const accessResult = await pool.query(accessQuery, [audioFileId, userId]);
      
      if (accessResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied' }
        });
      }

      // Check what zoom levels are cached
      const cachedZoomLevels = [];
      const zoomLevels = [1, ...WaveformCacheService.ZOOM_LEVELS];

      for (const zoom of zoomLevels) {
        const cached = await WaveformCacheService.getOptimalWaveform(audioFileId, zoom);
        if (cached) {
          cachedZoomLevels.push(zoom);
        }
      }

      const metadata = await WaveformCacheService.getWaveformMetadata(audioFileId);

      res.json({
        success: true,
        data: {
          audioFileId,
          cachedZoomLevels,
          hasFullWaveform: cachedZoomLevels.includes(1),
          metadata,
          status: cachedZoomLevels.length > 0 ? 'ready' : 'pending'
        }
      });

    } catch (error) {
      console.error('❌ Error getting waveform status:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get waveform status' }
      });
    }
  }
);

// Regenerate waveform (if needed)
router.post(
  '/regenerate/:audioFileId',
  authenticateToken,
  async (req: any, res) => {
    try {
      const { audioFileId } = req.params;
      const userId = req.user.userId;

      // Verify access and ownership
      const accessQuery = `
        SELECT p.creator_id
        FROM audio_files af
        JOIN projects p ON af.project_id = p.id
        WHERE af.id = $1 
        AND p.creator_id = $2
      `;

      const accessResult = await pool.query(accessQuery, [audioFileId, userId]);
      
      if (accessResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied - must be project owner' }
        });
      }

      // Invalidate existing cache
      await WaveformCacheService.invalidateWaveform(audioFileId);

      // Regenerate waveform
      const waveformData = await WaveformCacheService.generateAndCacheWaveform(audioFileId);

      if (!waveformData) {
        return res.status(500).json({
          success: false,
          error: { message: 'Failed to regenerate waveform' }
        });
      }

      res.json({
        success: true,
        message: 'Waveform regenerated successfully',
        data: {
          samples: waveformData.length,
          generated: true
        }
      });

    } catch (error) {
      console.error('❌ Error regenerating waveform:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to regenerate waveform' }
      });
    }
  }
);

// Bulk waveform status for project
router.get(
  '/project/:projectId/status',
  authenticateToken,
  async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.userId;

      // Verify access
      const projectQuery = `
        SELECT p.id 
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE p.id = $1 
        AND (p.creator_id = $2 OR pc.user_id = $2)
      `;

      const projectResult = await pool.query(projectQuery, [projectId, userId]);
      
      if (projectResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied to project' }
        });
      }

      // Get all audio files in project
      const audioFilesQuery = `
        SELECT id, filename, duration 
        FROM audio_files 
        WHERE project_id = $1 
        ORDER BY created_at ASC
      `;

      const audioFilesResult = await pool.query(audioFilesQuery, [projectId]);
      const audioFiles = audioFilesResult.rows;

      // Check cache status for each file
      const fileStatuses = await Promise.all(
        audioFiles.map(async (file) => {
          const hasWaveform = await WaveformCacheService.getOptimalWaveform(file.id, 1);
          const metadata = await WaveformCacheService.getWaveformMetadata(file.id);
          
          return {
            audioFileId: file.id,
            filename: file.filename,
            duration: file.duration,
            hasWaveform: !!hasWaveform,
            metadata,
            status: hasWaveform ? 'ready' : 'pending'
          };
        })
      );

      const readyCount = fileStatuses.filter(f => f.hasWaveform).length;
      const totalCount = fileStatuses.length;

      res.json({
        success: true,
        data: {
          projectId,
          files: fileStatuses,
          summary: {
            ready: readyCount,
            total: totalCount,
            percentage: totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0
          }
        }
      });

    } catch (error) {
      console.error('❌ Error getting project waveform status:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get project waveform status' }
      });
    }
  }
);

export default router;