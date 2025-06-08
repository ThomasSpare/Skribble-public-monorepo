// backend/src/models/Annotation.ts
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { Annotation, User } from '../types/index';

interface CreateAnnotationData {
  audioFileId: string;
  userId: string;
  timestamp: number;
  text: string;
  voiceNoteUrl?: string;
  annotationType?: 'comment' | 'marker' | 'voice' | 'section' | 'issue' | 'approval';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'in-progress' | 'resolved' | 'approved';
  parentId?: string;
  mentions?: string[];
}

interface UpdateAnnotationData {
  text?: string;
  voiceNoteUrl?: string;
  annotationType?: 'comment' | 'marker' | 'voice' | 'section' | 'issue' | 'approval';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'in-progress' | 'resolved' | 'approved';
  mentions?: string[];
}

export class AnnotationModel {
  // Create a new annotation
  static async create(annotationData: CreateAnnotationData): Promise<Annotation> {
  const id = uuidv4();
  const now = new Date();

  const fields = [
    'id', 'audio_file_id', 'user_id', 'timestamp', 'text', 'annotation_type', 'priority', 'status', 'mentions', 'created_at', 'updated_at'
  ];
  const values = [
    id, annotationData.audioFileId, annotationData.userId, annotationData.timestamp, annotationData.text,
    annotationData.annotationType || 'comment', annotationData.priority || 'medium', annotationData.status || 'pending',
    annotationData.mentions || [], now, now
  ];
  const valuePlaceholders = ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', '$9', '$10', '$11'];

  let parentIdPlaceholder = '$12'; // Initialize parentIdPlaceholder

  if (annotationData.voiceNoteUrl) {
    fields.splice(5, 0, 'voice_note_url');
    values.splice(5, 0, annotationData.voiceNoteUrl);
    valuePlaceholders.splice(5, 0, '$6');
    parentIdPlaceholder = '$7'; // Adjust parentIdPlaceholder if voiceNoteUrl is present
  }

  if (annotationData.parentId) {
    fields.push('parent_id');
    values.push(annotationData.parentId);
    valuePlaceholders.push(parentIdPlaceholder);
  }

  const query = `
    INSERT INTO annotations (${fields.join(', ')})
    VALUES (${valuePlaceholders.join(', ')})
    RETURNING *
  `;

  try {
    const result = await pool.query(query, values);
    return this.getAnnotationWithUser(id);
  } catch (error) {
    throw error;
  }
}

  // Find annotation by ID
  static async findById(id: string): Promise<Annotation | null> {
    return this.getAnnotationWithUser(id);
  }

  // Get annotations for an audio file
  static async findByAudioFileId(audioFileId: string): Promise<Annotation[]> {
    const query = `
      SELECT a.*, u.id as user_id, u.username, u.email, u.role, 
             u.subscription_tier, u.profile_image, u.created_at as user_created_at,
             u.updated_at as user_updated_at
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.audio_file_id = $1
      ORDER BY a.timestamp ASC, a.created_at ASC
    `;

    try {
      const result = await pool.query(query, [audioFileId]);
      return result.rows.map(row => this.mapRowToAnnotation(row));
    } catch (error) {
      throw error;
    }
  }

  // Get annotations for a project
  static async findByProjectId(projectId: string): Promise<Annotation[]> {
    const query = `
      SELECT a.*, u.id as user_id, u.username, u.email, u.role, 
             u.subscription_tier, u.profile_image, u.created_at as user_created_at,
             u.updated_at as user_updated_at
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      JOIN audio_files af ON a.audio_file_id = af.id
      WHERE af.project_id = $1
      ORDER BY a.timestamp ASC, a.created_at ASC
    `;

    try {
      const result = await pool.query(query, [projectId]);
      return result.rows.map(row => this.mapRowToAnnotation(row));
    } catch (error) {
      throw error;
    }
  }

  // Get annotations by user
  static async findByUserId(userId: string, limit: number = 50): Promise<Annotation[]> {
    const query = `
      SELECT a.*, u.id as user_id, u.username, u.email, u.role, 
             u.subscription_tier, u.profile_image, u.created_at as user_created_at,
             u.updated_at as user_updated_at
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [userId, limit]);
      return result.rows.map(row => this.mapRowToAnnotation(row));
    } catch (error) {
      throw error;
    }
  }

  // Get threaded annotations (replies to a parent)
  static async findReplies(parentId: string): Promise<Annotation[]> {
    const query = `
      SELECT a.*, u.id as user_id, u.username, u.email, u.role, 
             u.subscription_tier, u.profile_image, u.created_at as user_created_at,
             u.updated_at as user_updated_at
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.parent_id = $1
      ORDER BY a.created_at ASC
    `;

    try {
      const result = await pool.query(query, [parentId]);
      return result.rows.map(row => this.mapRowToAnnotation(row));
    } catch (error) {
      throw error;
    }
  }

  // Update annotation
  static async update(id: string, updateData: UpdateAnnotationData): Promise<Annotation | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'mentions') {
          fields.push(`mentions = $${paramCount}`);
          values.push(value);
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
      UPDATE annotations 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      if (result.rows.length === 0) return null;
      
      return this.getAnnotationWithUser(id);
    } catch (error) {
      throw error;
    }
  }

  // Delete annotation
  static async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM annotations WHERE id = $1`;

    try {
      const result = await pool.query(query, [id]);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      throw error;
    }
  }

  // Get annotations with filters
  static async findWithFilters(
    audioFileId: string,
    filters: {
      status?: string[];
      priority?: string[];
      type?: string[];
      userId?: string;
      timeRange?: { start: number; end: number };
    }
  ): Promise<Annotation[]> {
    let query = `
      SELECT a.*, u.id as user_id, u.username, u.email, u.role, 
             u.subscription_tier, u.profile_image, u.created_at as user_created_at,
             u.updated_at as user_updated_at
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.audio_file_id = $1
    `;
    
    const values: Array<string | string[] | number> = [audioFileId];
    let paramCount = 2;

    // Add filters
    if (filters.status && filters.status.length > 0) {
      query += ` AND a.status = ANY($${paramCount}::text[])`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.priority && filters.priority.length > 0) {
      query += ` AND a.priority = ANY($${paramCount}::text[])`;
      values.push(filters.priority);
      paramCount++;
    }

    if (filters.type && filters.type.length > 0) {
      query += ` AND a.annotation_type = ANY($${paramCount}::text[])`;
      values.push(filters.type);
      paramCount++;
    }

    if (filters.userId) {
      query += ` AND a.user_id = $${paramCount}`;
      values.push(filters.userId);
      paramCount++;
    }

    if (filters.timeRange) {
      query += ` AND a.timestamp BETWEEN $${paramCount} AND $${paramCount + 1}`;
      values.push(filters.timeRange.start.toString());
      values.push(filters.timeRange.end.toString());
      paramCount += 2;
    }

    query += ` ORDER BY a.timestamp ASC, a.created_at ASC`;

    try {
      const result = await pool.query(query, values);
      return result.rows.map(row => this.mapRowToAnnotation(row));
    } catch (error) {
      throw error;
    }
  }

  // Get annotation statistics for a project
  static async getProjectStats(projectId: string) {
    const query = `
      SELECT 
        COUNT(*) as total_annotations,
        COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN a.status = 'resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN a.priority = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN a.priority = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN a.annotation_type = 'voice' THEN 1 END) as voice_notes_count,
        COUNT(DISTINCT a.user_id) as unique_contributors
      FROM annotations a
      JOIN audio_files af ON a.audio_file_id = af.id
      WHERE af.project_id = $1
    `;

    try {
      const result = await pool.query(query, [projectId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get mentions for a user
  static async findMentions(userId: string): Promise<Annotation[]> {
    const query = `
      SELECT a.*, u.id as user_id, u.username, u.email, u.role, 
             u.subscription_tier, u.profile_image, u.created_at as user_created_at,
             u.updated_at as user_updated_at
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE $1 = ANY(a.mentions)
      ORDER BY a.created_at DESC
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows.map(row => this.mapRowToAnnotation(row));
    } catch (error) {
      throw error;
    }
  }

  static async resolve(id: string): Promise<Annotation | null> {
    const query = `
      UPDATE annotations 
      SET status = 'resolved', updated_at = $1
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [new Date(), id]);
      if (result.rows.length === 0) return null;
      
      return this.getAnnotationWithUser(id);
    } catch (error) {
      throw error;
    }
  }

  // Private helper methods
  private static async getAnnotationWithUser(id: string): Promise<Annotation> {
    const query = `
      SELECT a.*, u.id as user_id, u.username, u.email, u.role, 
             u.subscription_tier, u.profile_image, u.created_at as user_created_at,
             u.updated_at as user_updated_at
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = $1
    `;

    try {
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) {
        throw new Error('Annotation not found');
      }
      return this.mapRowToAnnotation(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  private static mapRowToAnnotation(row: any): Annotation {
    return {
      id: row.id,
      audioFileId: row.audio_file_id,
      userId: row.user_id,
      user: {
        id: row.user_id,
        username: row.username,
        email: row.email,
        role: row.role,
        subscriptionTier: row.subscription_tier,
        profileImage: row.profile_image,
        createdAt: row.user_created_at,
        updatedAt: row.user_updated_at
      },
      timestamp: row.timestamp,
      text: row.text,
      voiceNoteUrl: row.voice_note_url,
      annotationType: row.annotation_type,
      priority: row.priority,
      status: row.status,
      parentId: row.parent_id,
      mentions: row.mentions || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

// Convenience exports
export const createAnnotation = (annotationData: CreateAnnotationData) => AnnotationModel.create(annotationData);
export const findAnnotationById = (id: string) => AnnotationModel.findById(id);
export const findAnnotationsByAudioFileId = (audioFileId: string) => AnnotationModel.findByAudioFileId(audioFileId);
export const updateAnnotation = (id: string, updateData: UpdateAnnotationData) => AnnotationModel.update(id, updateData);
export const resolveAnnotation = (id: string) => AnnotationModel.resolve(id);