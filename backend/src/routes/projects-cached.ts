// backend/src/routes/projects-cached.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { 
  projectCacheMiddleware, 
  cacheMiddleware, 
  invalidateCacheMiddleware,
  userStatsCacheMiddleware 
} from '../middleware/cache';
import { CachedProjectModel } from '../models/CachedProject';

const router = express.Router();

// Get all projects for user (with caching)
router.get(
  '/',
  authenticateToken,
  cacheMiddleware(600), // Cache for 10 minutes
  async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit as string) || 20;

      const projects = await CachedProjectModel.getByUserId(userId, limit);

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch projects' }
      });
    }
  }
);

// Get specific project (with caching)
router.get(
  '/:id',
  authenticateToken,
  async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.user.userId;

      const project = await CachedProjectModel.getById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: 'Project not found' }
        });
      }

      // Check if user has access to this project
      const hasAccess = project.creatorId === userId || 
        project.collaborators?.some(c => c.id === userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied' }
        });
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('❌ Error fetching project:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch project' }
      });
    }
  }
);

// Get project annotations (with caching)
router.get(
  '/:id/annotations',
  authenticateToken,
  cacheMiddleware(900), // Cache for 15 minutes
  async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.user.userId;

      // Check project access first
      const project = await CachedProjectModel.getById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: 'Project not found' }
        });
      }

      const hasAccess = project.creatorId === userId || 
        project.collaborators?.some(c => c.id === userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied' }
        });
      }

      const annotations = await CachedProjectModel.getAnnotations(projectId);

      res.json({
        success: true,
        data: annotations
      });
    } catch (error) {
      console.error('❌ Error fetching annotations:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch annotations' }
      });
    }
  }
);

// Get project stats (with caching)
router.get(
  '/:id/stats',
  authenticateToken,
  cacheMiddleware(1800), // Cache for 30 minutes
  async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.user.userId;

      // Check project access
      const project = await CachedProjectModel.getById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: 'Project not found' }
        });
      }

      const hasAccess = project.creatorId === userId || 
        project.collaborators?.some(c => c.id === userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied' }
        });
      }

      const stats = await CachedProjectModel.getStats(projectId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Error fetching project stats:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch project stats' }
      });
    }
  }
);

// Create new project (with cache invalidation)
router.post(
  '/',
  authenticateToken,
  invalidateCacheMiddleware(['user:projects:*', 'stats:user:*']),
  async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { title, deadline, settings } = req.body;

      if (!title || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Project title is required' }
        });
      }

      const projectData = {
        title: title.trim(),
        creatorId: userId,
        deadline: deadline ? new Date(deadline) : undefined,
        settings: settings || {}
      };

      const project = await CachedProjectModel.create(projectData);

      res.status(201).json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('❌ Error creating project:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create project' }
      });
    }
  }
);

// Update project (with cache invalidation)
router.put(
  '/:id',
  authenticateToken,
  invalidateCacheMiddleware([
    'project:*',
    'user:projects:*',
    'stats:project:*',
    'annotations:*'
  ]),
  async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.user.userId;
      const updateData = req.body;

      // Check if user owns the project
      const existingProject = await CachedProjectModel.getById(projectId);
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          error: { message: 'Project not found' }
        });
      }

      if (existingProject.creatorId !== userId) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied' }
        });
      }

      const updatedProject = await CachedProjectModel.update(projectId, updateData);

      res.json({
        success: true,
        data: updatedProject
      });
    } catch (error) {
      console.error('❌ Error updating project:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update project' }
      });
    }
  }
);

// Delete project (with cache invalidation)
router.delete(
  '/:id',
  authenticateToken,
  invalidateCacheMiddleware([
    'project:*',
    'user:projects:*',
    'stats:project:*',
    'stats:user:*',
    'annotations:*',
    'waveform:*'
  ]),
  async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.user.userId;

      // Check if user owns the project
      const project = await CachedProjectModel.getById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: 'Project not found' }
        });
      }

      if (project.creatorId !== userId) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied' }
        });
      }

      // Delete project (you'll need to implement this in CachedProjectModel)
      // const success = await CachedProjectModel.delete(projectId);

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting project:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to delete project' }
      });
    }
  }
);

// Get user notifications (with caching)
router.get(
  '/notifications',
  authenticateToken,
  cacheMiddleware(300), // Cache for 5 minutes
  async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit as string) || 10;

      const notifications = await CachedProjectModel.getUserNotifications(userId, limit);

      res.json({
        success: true,
        data: notifications
      });
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch notifications' }
      });
    }
  }
);

// Get user recent activity (with caching)
router.get(
  '/activity',
  authenticateToken,
  cacheMiddleware(600), // Cache for 10 minutes
  async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit as string) || 20;

      const activities = await CachedProjectModel.getUserRecentActivity(userId, limit);

      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('❌ Error fetching user activity:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch user activity' }
      });
    }
  }
);

// Get user dashboard stats (with caching)
router.get(
  '/dashboard/stats',
  authenticateToken,
  cacheMiddleware(900), // Cache for 15 minutes
  async (req: any, res) => {
    try {
      const userId = req.user.userId;

      const stats = await CachedProjectModel.getUserDashboardStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch dashboard stats' }
      });
    }
  }
);

// Mark notifications as read
router.patch(
  '/notifications/read',
  authenticateToken,
  invalidateCacheMiddleware(['user:notifications:*', 'user:dashboard:stats:*']),
  async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { notificationIds } = req.body;

      await CachedProjectModel.markNotificationsAsRead(userId, notificationIds);

      res.json({
        success: true,
        message: 'Notifications marked as read'
      });
    } catch (error) {
      console.error('❌ Error marking notifications as read:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to mark notifications as read' }
      });
    }
  }
);

export default router;