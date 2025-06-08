// backend/src/models/Project.ts
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { Project, ProjectSettings, User, ProjectCollaborator, AudioFile } from '../types/index';

interface CreateProjectData {
  title: string;
  creatorId: string;
  status?: 'active' | 'completed' | 'archived';
  deadline?: Date;
  settings: ProjectSettings;
}

interface UpdateProjectData {
  title?: string;
  status?: 'active' | 'completed' | 'archived';
  deadline?: Date;
  settings?: ProjectSettings;
}

export class ProjectModel {
  // Create a new project
  static async create(projectData: CreateProjectData): Promise<Project> {
    const id = uuidv4();
    const shareLink = this.generateShareLink();
    const now = new Date();

    const query = `
      INSERT INTO projects (
        id, title, creator_id, status, deadline, share_link, settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      id,
      projectData.title,
      projectData.creatorId,
      projectData.status || 'active',
      projectData.deadline || null,
      shareLink,
      JSON.stringify(projectData.settings),
      now,
      now
    ];

    try {
      const result = await pool.query(query, values);
      const project = await this.getProjectWithDetails(id);
      return project!;
    } catch (error) {
      throw error;
    }
  }

  // Find project by ID with full details
  static async findById(id: string): Promise<Project | null> {
    return this.getProjectWithDetails(id);
  }

  // Find project by share link
  static async findByShareLink(shareLink: string): Promise<Project | null> {
    const query = `
      SELECT id FROM projects WHERE share_link = $1
    `;

    try {
      const result = await pool.query(query, [shareLink]);
      if (result.rows.length === 0) return null;
      
      return this.getProjectWithDetails(result.rows[0].id);
    } catch (error) {
      throw error;
    }
  }

  // Get user's projects
  static async findByUserId(userId: string, limit: number = 20, offset: number = 0): Promise<Project[]> {
    const query = `
      SELECT DISTINCT p.id,
            COALESCE(annotation_stats.total_annotations, 0) as annotation_count
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      LEFT JOIN (
        SELECT af.project_id, COUNT(a.id) as total_annotations
        FROM audio_files af
        LEFT JOIN annotations a ON af.id = a.audio_file_id
        GROUP BY af.project_id
      ) annotation_stats ON p.id = annotation_stats.project_id
      WHERE p.creator_id = $1 OR (pc.user_id = $1 AND pc.status = 'accepted')
      ORDER BY p.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await pool.query(query, [userId, limit, offset]);
      
      // Fetch full project details for each project (now includes annotation counts)
      const projects = await Promise.all(
        result.rows.map(row => this.getProjectWithDetails(row.id))
      );
      
      return projects.filter(p => p !== null) as Project[];
    } catch (error) {
      throw error;
    }
  }

  // Update project
  static async update(id: string, updateData: UpdateProjectData): Promise<Project | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
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

    // Add updated_at
    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    paramCount++;

    // Add ID for WHERE clause
    values.push(id);

    const query = `
      UPDATE projects 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      if (result.rows.length === 0) return null;
      
      return this.getProjectWithDetails(id);
    } catch (error) {
      throw error;
    }
  }

  // Delete project
  static async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM projects WHERE id = $1`;

    try {
      const result = await pool.query(query, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // Archive project
  static async archive(id: string): Promise<Project | null> {
    return this.update(id, { status: 'archived' });
  }

  // Get project statistics
  static async getStats(id: string) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM audio_files WHERE project_id = $1) as total_versions,
        (SELECT COUNT(*) FROM annotations a 
         JOIN audio_files af ON a.audio_file_id = af.id 
         WHERE af.project_id = $1) as total_annotations,
        (SELECT COUNT(*) FROM project_collaborators WHERE project_id = $1 AND status = 'accepted') as total_collaborators,
        (SELECT COUNT(*) FROM annotations a 
         JOIN audio_files af ON a.audio_file_id = af.id 
         WHERE af.project_id = $1 AND a.status = 'resolved') as resolved_annotations
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Check if user can access project
  static async canUserAccess(projectId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = $1 AND (
        p.creator_id = $2 OR 
        (pc.user_id = $2 AND pc.status = 'accepted')
      )
      LIMIT 1
    `;

    try {
      const result = await pool.query(query, [projectId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  // Get user's role in project
  static async getUserRole(projectId: string, userId: string): Promise<string | null> {
    const query = `
      SELECT 
        CASE 
          WHEN p.creator_id = $2 THEN 'admin'
          ELSE pc.role
        END as role
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE p.id = $1
    `;

    try {
      const result = await pool.query(query, [projectId, userId]);
      return result.rows.length > 0 ? result.rows[0].role : null;
    } catch (error) {
      throw error;
    }
  }

  // Search projects
  static async search(userId: string, searchTerm: string, limit: number = 10): Promise<Project[]> {
    const query = `
      SELECT DISTINCT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE (p.creator_id = $1 OR (pc.user_id = $1 AND pc.status = 'accepted'))
      AND (p.title ILIKE $2)
      ORDER BY p.updated_at DESC
      LIMIT $3
    `;

    try {
      const result = await pool.query(query, [userId, `%${searchTerm}%`, limit]);
      const projectIds = result.rows.map(row => row.id);
      
      const projects = await Promise.all(
        projectIds.map(id => this.getProjectWithDetails(id))
      );
      
      return projects.filter(p => p !== null) as Project[];
    } catch (error) {
      throw error;
    }
  }

  // Private helper methods
  private static async getProjectWithDetails(id: string): Promise<Project | null> {
    const projectQuery = `
      SELECT p.*, u.id as creator_id, u.username as creator_username, 
            u.email as creator_email, u.role as creator_role,
            u.subscription_tier as creator_subscription_tier,
            u.profile_image as creator_profile_image,
            u.created_at as creator_created_at, u.updated_at as creator_updated_at,
            -- Get annotation count for this project
            COALESCE(annotation_stats.total_annotations, 0) as annotation_count
      FROM projects p
      JOIN users u ON p.creator_id = u.id
      LEFT JOIN (
        SELECT af.project_id, COUNT(a.id) as total_annotations
        FROM audio_files af
        LEFT JOIN annotations a ON af.id = a.audio_file_id
        WHERE af.project_id = $1
        GROUP BY af.project_id
      ) annotation_stats ON p.id = annotation_stats.project_id
      WHERE p.id = $1
    `;

    try {
      const projectResult = await pool.query(projectQuery, [id]);
      if (projectResult.rows.length === 0) return null;

      const row = projectResult.rows[0];

      // Get collaborators
      const collaborators = await this.getProjectCollaborators(id);
      
      // Get audio files
      const audioFiles = await this.getProjectAudioFiles(id);

      return {
        id: row.id,
        title: row.title,
        creatorId: row.creator_id,
        creator: {
          id: row.creator_id,
          username: row.creator_username,
          email: row.creator_email,
          role: row.creator_role,
          subscriptionTier: row.creator_subscription_tier,
          profileImage: row.creator_profile_image,
          createdAt: row.creator_created_at,
          updatedAt: row.creator_updated_at
        },
        status: row.status,
        deadline: row.deadline,
        shareLink: row.share_link,
        settings: JSON.parse(row.settings),
        collaborators,
        audioFiles,
        // ✨ NEW: Include annotation count
        annotationCount: parseInt(row.annotation_count) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      throw error;
    }
  }


  private static async getProjectCollaborators(projectId: string): Promise<ProjectCollaborator[]> {
    const query = `
      SELECT pc.*, u.username, u.email, u.role as user_role, 
             u.subscription_tier, u.profile_image, u.created_at as user_created_at,
             u.updated_at as user_updated_at
      FROM project_collaborators pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.project_id = $1
      ORDER BY pc.invited_at DESC
    `;

    try {
      const result = await pool.query(query, [projectId]);
      return result.rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        user: {
          id: row.user_id,
          username: row.username,
          email: row.email,
          role: row.user_role,
          subscriptionTier: row.subscription_tier,
          profileImage: row.profile_image,
          createdAt: row.user_created_at,
          updatedAt: row.user_updated_at
        },
        role: row.role,
        permissions: JSON.parse(row.permissions),
        invitedBy: row.invited_by,
        invitedAt: row.invited_at,
        acceptedAt: row.accepted_at,
        status: row.status
      }));
    } catch (error) {
      throw error;
    }
  }

  private static async getProjectAudioFiles(projectId: string): Promise<AudioFile[]> {
    const query = `
      SELECT * FROM audio_files 
      WHERE project_id = $1 
      ORDER BY uploaded_at DESC
    `;

    try {
      const result = await pool.query(query, [projectId]);
      return result.rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        version: row.version,
        filename: row.filename,
        originalFilename: row.original_filename,
        fileUrl: row.file_url,
        duration: row.duration,
        sampleRate: row.sample_rate,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        waveformData: row.waveform_data ? JSON.parse(row.waveform_data) : undefined,
        uploadedBy: row.uploaded_by,
        uploadedAt: row.uploaded_at,
        isActive: row.is_active
      }));
    } catch (error) {
      throw error;
    }
  }

  private static generateShareLink(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

// Convenience exports
export const createProject = (projectData: CreateProjectData) => ProjectModel.create(projectData);
export const findProjectById = (id: string) => ProjectModel.findById(id);
export const findProjectByShareLink = (shareLink: string) => ProjectModel.findByShareLink(shareLink);
export const updateProject = (id: string, updateData: UpdateProjectData) => ProjectModel.update(id, updateData);