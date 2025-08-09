// backend/src/models/CachedProject.ts
import pool from '../config/database';
import redisCacheService from '../services/redis-cache';
import crypto from 'crypto';

export interface Project {
  id: string;
  title: string;
  creatorId: string;
  creator: {
    username: string;
    email: string;
  };
  status: 'active' | 'completed' | 'archived';
  deadline?: Date;
  shareLink: string;
  settings: any;
  createdAt: Date;
  updatedAt: Date;
  audioFiles?: any[];
  collaborators?: any[];
  annotations?: number; // Changed from array to count
}

export class CachedProjectModel {
  // Get project with intelligent caching
  static async getById(id: string): Promise<Project | null> {
    try {
      // Try cache first
      const cached = await redisCacheService.getProject(id);
      if (cached) {
        console.log(`✅ Project cache hit: ${id}`);
        return cached;
      }

      console.log(`❌ Project cache miss: ${id}`);

      // Get from database with all related data in single query
      const query = `
        SELECT 
          p.*,
          creator.username as creator_username,
          creator.email as creator_email,
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', af.id,
              'projectId', af.project_id,
              'version', af.version,
              'filename', af.filename,
              'originalFilename', af.original_filename,
              'fileUrl', af.file_url,
              'fileSize', af.file_size,
              'duration', af.duration,
              'sampleRate', af.sample_rate,
              'mimeType', af.mime_type,
              'waveformData', af.waveform_data,
              'uploadedBy', af.uploaded_by,
              'uploadedAt', af.uploaded_at,
              'isActive', af.is_active
            )
          ) FILTER (WHERE af.id IS NOT NULL) as audio_files,
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', pc.user_id,
              'role', pc.role,
              'permissions', pc.permissions,
              'user', jsonb_build_object(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'profileImage', u.profile_image
              )
            )
          ) FILTER (WHERE pc.user_id IS NOT NULL) as collaborators
        FROM projects p
        LEFT JOIN users creator ON p.creator_id = creator.id
        LEFT JOIN audio_files af ON p.id = af.project_id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        LEFT JOIN users u ON pc.user_id = u.id
        WHERE p.id = $1
        GROUP BY p.id, creator.username, creator.email
      `;

      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const project = this.mapRowToProject(result.rows[0]);

      // Cache the result
      await redisCacheService.setProject(id, project, 1800); // 30 minutes

      return project;
    } catch (error) {
      console.error('❌ Error getting project:', error);
      throw error;
    }
  }

  // Get projects for user with caching
  static async getByUserId(userId: string, limit: number = 20): Promise<Project[]> {
    try {
      // Generate cache key for user's projects
      const cacheKey = `user:projects:${userId}:${limit}`;
      const cached = await redisCacheService.get<Project[]>(cacheKey);
      
      if (cached) {
        console.log(`✅ User projects cache hit: ${userId}`);
        return cached;
      }

      console.log(`❌ User projects cache miss: ${userId}`);

      const query = `
        SELECT 
          p.*, 
          creator.username as creator_username,
          creator.email as creator_email,
          COALESCE(stats.audio_file_count, 0) as audio_file_count,
          COALESCE(stats.collaborator_count, 0) as collaborator_count,
          COALESCE(stats.annotation_count, 0) as annotation_count,
          stats.latest_audio_file,
          COALESCE(collab_data.collaborators, '[]'::json) as collaborators,
          COALESCE(audio_data.audio_files, '[]'::json) as audio_files
        FROM projects p
        LEFT JOIN users creator ON p.creator_id = creator.id
        LEFT JOIN (
          SELECT 
            p2.id,
            COUNT(DISTINCT af.id) as audio_file_count,
            COUNT(DISTINCT pc.user_id) as collaborator_count,
            COUNT(DISTINCT ann.id) as annotation_count,
            MAX(af.uploaded_at) as latest_audio_file
          FROM projects p2
          LEFT JOIN audio_files af ON p2.id = af.project_id
          LEFT JOIN project_collaborators pc ON p2.id = pc.project_id
          LEFT JOIN annotations ann ON af.id = ann.audio_file_id
          WHERE p2.creator_id = $1 OR p2.id IN (
            SELECT project_id FROM project_collaborators WHERE user_id = $1
          )
          GROUP BY p2.id
        ) stats ON p.id = stats.id
        LEFT JOIN (
          SELECT 
            pc.project_id,
            JSON_AGG(
              jsonb_build_object(
                'id', pc.user_id,
                'role', pc.role,
                'permissions', pc.permissions,
                'user', jsonb_build_object(
                  'id', collab_user.id,
                  'username', collab_user.username,
                  'email', collab_user.email,
                  'profileImage', collab_user.profile_image
                )
              )
            ) as collaborators
          FROM project_collaborators pc
          JOIN users collab_user ON pc.user_id = collab_user.id
          WHERE pc.project_id IN (
            SELECT id FROM projects WHERE creator_id = $1
            UNION
            SELECT project_id FROM project_collaborators WHERE user_id = $1
          )
          GROUP BY pc.project_id
        ) collab_data ON p.id = collab_data.project_id
        LEFT JOIN (
          SELECT 
            af.project_id,
            JSON_AGG(
              jsonb_build_object(
                'id', af.id,
                'filename', af.filename,
                'duration', af.duration,
                'version', af.version,
                'uploadedAt', af.uploaded_at,
                'isActive', af.is_active
              )
            ) as audio_files
          FROM audio_files af
          WHERE af.project_id IN (
            SELECT id FROM projects WHERE creator_id = $1
            UNION
            SELECT project_id FROM project_collaborators WHERE user_id = $1
          )
          GROUP BY af.project_id
        ) audio_data ON p.id = audio_data.project_id
        WHERE p.creator_id = $1 OR p.id IN (
          SELECT project_id FROM project_collaborators WHERE user_id = $1
        )
        ORDER BY p.updated_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      const projects = result.rows.map(row => this.mapRowToProject(row));

      // Cache for 10 minutes (shorter because this data changes more frequently)
      await redisCacheService.set(cacheKey, projects, 600);

      return projects;
    } catch (error) {
      console.error('❌ Error getting user projects:', error);
      throw error;
    }
  }

  // Get project annotations with caching
  static async getAnnotations(projectId: string): Promise<any[]> {
    try {
      const cached = await redisCacheService.getAnnotations(projectId);
      if (cached) {
        console.log(`✅ Annotations cache hit: ${projectId}`);
        return cached;
      }

      console.log(`❌ Annotations cache miss: ${projectId}`);

      const query = `
        SELECT 
          a.*,
          u.username,
          u.profile_image
        FROM annotations a
        JOIN users u ON a.user_id = u.id
        WHERE a.project_id = $1
        ORDER BY a.timestamp_start ASC
      `;

      const result = await pool.query(query, [projectId]);
      const annotations = result.rows;

      // Cache for 15 minutes
      await redisCacheService.setAnnotations(projectId, annotations, 900);

      return annotations;
    } catch (error) {
      console.error('❌ Error getting annotations:', error);
      throw error;
    }
  }

  // Create project and invalidate cache
  static async create(projectData: Partial<Project>): Promise<Project> {
    try {
      const query = `
        INSERT INTO projects (title, creator_id, status, deadline, share_link, settings)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const shareLink = this.generateShareLink();
      const values = [
        projectData.title,
        projectData.creatorId,
        projectData.status || 'active',
        projectData.deadline,
        shareLink,
        JSON.stringify(projectData.settings || {})
      ];

      const result = await pool.query(query, values);
      const project = this.mapRowToProject(result.rows[0]);

      // Invalidate user's project list cache
      await redisCacheService.invalidatePattern(`user:projects:${projectData.creatorId}:*`);

      return project;
    } catch (error) {
      console.error('❌ Error creating project:', error);
      throw error;
    }
  }

  // Update project and invalidate cache
  static async update(id: string, updateData: Partial<Project>): Promise<Project | null> {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id') {
          if (key === 'settings') {
            fields.push(`settings = $${paramCount}`);
            values.push(JSON.stringify(value));
          } else {
            const dbField = this.camelToSnake(key);
            fields.push(`${dbField} = $${paramCount}`);
            values.push(value);
          }
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE projects 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const project = this.mapRowToProject(result.rows[0]);

      // Invalidate all related caches
      await this.invalidateProjectCaches(id, project.creatorId);

      return project;
    } catch (error) {
      console.error('❌ Error updating project:', error);
      throw error;
    }
  }

  // Get project stats with caching
  static async getStats(projectId: string): Promise<any> {
    try {
      const cached = await redisCacheService.getProjectStats(projectId);
      if (cached) {
        console.log(`✅ Project stats cache hit: ${projectId}`);
        return cached;
      }

      console.log(`❌ Project stats cache miss: ${projectId}`);

      const query = `
        SELECT 
          COUNT(DISTINCT af.id) as audio_file_count,
          COUNT(DISTINCT a.id) as annotation_count,
          COUNT(DISTINCT pc.user_id) as collaborator_count,
          COUNT(DISTINCT CASE WHEN a.status = 'open' THEN a.id END) as open_annotation_count,
          AVG(af.duration) as avg_duration
        FROM projects p
        LEFT JOIN audio_files af ON p.id = af.project_id
        LEFT JOIN annotations a ON p.id = a.project_id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE p.id = $1
      `;

      const result = await pool.query(query, [projectId]);
      const stats = result.rows[0];

      // Convert string numbers to integers
      Object.keys(stats).forEach(key => {
        if (key !== 'avg_duration' && stats[key]) {
          stats[key] = parseInt(stats[key]);
        }
      });

      // Cache for 30 minutes
      await redisCacheService.setProjectStats(projectId, stats, 1800);

      return stats;
    } catch (error) {
      console.error('❌ Error getting project stats:', error);
      throw error;
    }
  }

  // Helper method to invalidate all project-related caches
  static async invalidateProjectCaches(projectId: string, creatorId?: string): Promise<void> {
    try {
      await redisCacheService.invalidateProjectCache(projectId);
      
      if (creatorId) {
        await redisCacheService.invalidatePattern(`user:projects:${creatorId}:*`);
        await redisCacheService.invalidatePattern(`stats:user:${creatorId}`);
      }

      await redisCacheService.invalidatePattern(`stats:project:${projectId}`);
      console.log(`✅ Invalidated caches for project: ${projectId}`);
    } catch (error) {
      console.error('❌ Error invalidating project caches:', error);
    }
  }

  // Map database row to Project object
  private static mapRowToProject(row: any): Project {
    return {
      id: row.id,
      title: row.title,
      creatorId: row.creator_id,
      creator: {
        username: row.creator_username,
        email: row.creator_email
      },
      status: row.status,
      deadline: row.deadline,
      shareLink: row.share_link,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      audioFiles: row.audio_files || [],
      collaborators: row.collaborators || [],
      annotations: parseInt(row.annotation_count) || 0
    };
  }

  // Convert camelCase to snake_case
  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // Get user notifications with caching
  static async getUserNotifications(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const cacheKey = `user:notifications:${userId}:${limit}`;
      const cached = await redisCacheService.get<any[]>(cacheKey);
      
      if (cached) {
        console.log(`✅ User notifications cache hit: ${userId}`);
        return cached;
      }

      console.log(`❌ User notifications cache miss: ${userId}`);

      const query = `
        SELECT 
          n.*,
          p.title as project_title,
          creator.username as creator_username
        FROM notifications n
        LEFT JOIN projects p ON n.project_id = p.id
        LEFT JOIN users creator ON p.creator_id = creator.id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      const notifications = result.rows;

      // Cache for 5 minutes (notifications need to be fresh)
      await redisCacheService.set(cacheKey, notifications, 300);

      return notifications;
    } catch (error) {
      console.error('❌ Error getting user notifications:', error);
      throw error;
    }
  }

  // Get recent project activities for user with caching
  static async getUserRecentActivity(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const cacheKey = `user:activity:${userId}:${limit}`;
      const cached = await redisCacheService.get<any[]>(cacheKey);
      
      if (cached) {
        console.log(`✅ User activity cache hit: ${userId}`);
        return cached;
      }

      console.log(`❌ User activity cache miss: ${userId}`);

      // Get recent activities across user's projects
      const query = `
        (
          SELECT 
            'annotation' as activity_type,
            a.id as activity_id,
            a.created_at as activity_time,
            'New annotation added' as activity_description,
            p.id as project_id,
            p.title as project_title,
            u.username as actor_username,
            u.profile_image as actor_profile_image,
            a.text as activity_data
          FROM annotations a
          JOIN audio_files af ON a.audio_file_id = af.id
          JOIN projects p ON af.project_id = p.id
          JOIN users u ON a.user_id = u.id
          WHERE p.creator_id = $1 OR p.id IN (
            SELECT project_id FROM project_collaborators WHERE user_id = $1
          )
        )
        UNION ALL
        (
          SELECT 
            'project_update' as activity_type,
            p.id as activity_id,
            p.updated_at as activity_time,
            'Project updated' as activity_description,
            p.id as project_id,
            p.title as project_title,
            creator.username as actor_username,
            creator.profile_image as actor_profile_image,
            NULL as activity_data
          FROM projects p
          JOIN users creator ON p.creator_id = creator.id
          WHERE p.creator_id = $1 OR p.id IN (
            SELECT project_id FROM project_collaborators WHERE user_id = $1
          )
          AND p.updated_at > p.created_at
        )
        UNION ALL
        (
          SELECT 
            'audio_upload' as activity_type,
            af.id as activity_id,
            af.uploaded_at as activity_time,
            'New audio file uploaded' as activity_description,
            p.id as project_id,
            p.title as project_title,
            uploader.username as actor_username,
            uploader.profile_image as actor_profile_image,
            af.original_filename as activity_data
          FROM audio_files af
          JOIN projects p ON af.project_id = p.id
          JOIN users uploader ON af.uploaded_by = uploader.id
          WHERE p.creator_id = $1 OR p.id IN (
            SELECT project_id FROM project_collaborators WHERE user_id = $1
          )
        )
        UNION ALL
        (
          SELECT 
            'collaborator_joined' as activity_type,
            pc.id as activity_id,
            COALESCE(pc.accepted_at, pc.invited_at) as activity_time,
            'New collaborator joined' as activity_description,
            p.id as project_id,
            p.title as project_title,
            collab.username as actor_username,
            collab.profile_image as actor_profile_image,
            pc.role as activity_data
          FROM project_collaborators pc
          JOIN projects p ON pc.project_id = p.id
          JOIN users collab ON pc.user_id = collab.id
          WHERE p.creator_id = $1 OR p.id IN (
            SELECT project_id FROM project_collaborators WHERE user_id = $1
          )
          AND pc.status = 'accepted'
        )
        ORDER BY activity_time DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      const activities = result.rows;

      // Cache for 10 minutes
      await redisCacheService.set(cacheKey, activities, 600);

      return activities;
    } catch (error) {
      console.error('❌ Error getting user recent activity:', error);
      throw error;
    }
  }

  // Get user dashboard stats with caching
  static async getUserDashboardStats(userId: string): Promise<any> {
    try {
      const cacheKey = `user:dashboard:stats:${userId}`;
      const cached = await redisCacheService.get<any>(cacheKey);
      
      if (cached) {
        console.log(`✅ User dashboard stats cache hit: ${userId}`);
        return cached;
      }

      console.log(`❌ User dashboard stats cache miss: ${userId}`);

      const query = `
        SELECT 
          COUNT(DISTINCT CASE WHEN p.creator_id = $1 THEN p.id END) as owned_projects,
          COUNT(DISTINCT CASE WHEN pc.user_id = $1 THEN p.id END) as collaborated_projects,
          COUNT(DISTINCT p.id) as total_projects,
          COUNT(DISTINCT af.id) as total_audio_files,
          COUNT(DISTINCT a.id) as total_annotations,
          COUNT(DISTINCT CASE WHEN n.read = false THEN n.id END) as unread_notifications,
          COUNT(DISTINCT pc2.user_id) as total_collaborators
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $1
        LEFT JOIN project_collaborators pc2 ON p.id = pc2.project_id
        LEFT JOIN audio_files af ON p.id = af.project_id
        LEFT JOIN annotations a ON af.id = a.audio_file_id
        LEFT JOIN notifications n ON n.user_id = $1 AND n.project_id = p.id
        WHERE p.creator_id = $1 OR pc.user_id = $1
      `;

      const result = await pool.query(query, [userId]);
      const stats = result.rows[0];

      // Convert string numbers to integers
      Object.keys(stats).forEach(key => {
        if (stats[key]) {
          stats[key] = parseInt(stats[key]);
        }
      });

      // Cache for 15 minutes
      await redisCacheService.set(cacheKey, stats, 900);

      return stats;
    } catch (error) {
      console.error('❌ Error getting user dashboard stats:', error);
      throw error;
    }
  }

  // Create notification and invalidate cache
  static async createNotification(notificationData: {
    userId: string;
    projectId?: string;
    type: string;
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    try {
      const query = `
        INSERT INTO notifications (user_id, project_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

      const values = [
        notificationData.userId,
        notificationData.projectId,
        notificationData.type,
        notificationData.title,
        notificationData.message,
        JSON.stringify(notificationData.data || {})
      ];

      await pool.query(query, values);

      // Invalidate user notification cache
      await redisCacheService.invalidatePattern(`user:notifications:${notificationData.userId}:*`);
      await redisCacheService.invalidatePattern(`user:dashboard:stats:${notificationData.userId}`);

      console.log(`✅ Notification created for user: ${notificationData.userId}`);
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  // Mark notifications as read
  static async markNotificationsAsRead(userId: string, notificationIds?: string[]): Promise<void> {
    try {
      let query: string;
      let values: any[];

      if (notificationIds && notificationIds.length > 0) {
        // Mark specific notifications as read
        query = `
          UPDATE notifications 
          SET read = true, updated_at = NOW()
          WHERE user_id = $1 AND id = ANY($2::uuid[])
        `;
        values = [userId, notificationIds];
      } else {
        // Mark all notifications as read for user
        query = `
          UPDATE notifications 
          SET read = true, updated_at = NOW()
          WHERE user_id = $1 AND read = false
        `;
        values = [userId];
      }

      await pool.query(query, values);

      // Invalidate notification and dashboard caches
      await redisCacheService.invalidatePattern(`user:notifications:${userId}:*`);
      await redisCacheService.invalidatePattern(`user:dashboard:stats:${userId}`);

      console.log(`✅ Notifications marked as read for user: ${userId}`);
    } catch (error) {
      console.error('❌ Error marking notifications as read:', error);
      throw error;
    }
  }

  // Generate unique share link
  private static generateShareLink(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}