// backend/src/models/User.ts
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../types/index';

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
}

interface CreateUserData {
  email: string;
  username: string;
  password: string;
  role: 'producer' | 'artist' | 'both';
  subscriptionTier: 'free' | 'indie' | 'producer' | 'studio';
  profileImage?: string;
  stripeCustomerId?: string;
}

interface UpdateUserData {
  username?: string;
  role?: 'producer' | 'artist' | 'both';
  subscriptionTier?: 'free' | 'indie' | 'producer' | 'studio';
  profileImage?: string;
  stripeCustomerId?: string;
}

export class UserModel {
  // Create a new user (with mandatory subscription for non-free tiers)
  static async create(userData: CreateUserData): Promise<User> {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO users (
        id, email, username, password, role, subscription_tier, 
        profile_image, stripe_customer_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email, username, role, subscription_tier, 
                profile_image, stripe_customer_id, created_at, updated_at
    `;

    const values = [
      id,
      userData.email,
      userData.username,
      userData.password,
      userData.role,
      userData.subscriptionTier,
      userData.profileImage || null,
      userData.stripeCustomerId || null,
      now,
      now
    ];

    try {
      const result = await pool.query(query, values);
      return this.mapRowToUser(result.rows[0]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        const pgError = error as PostgresError;
        if (pgError.code === '23505') { // Unique violation
          if (pgError.constraint === 'users_email_key') {
            throw new Error('User with this email already exists');
          }
          if (pgError.constraint === 'users_username_key') {
            throw new Error('Username already taken');
          }
        }
      }
      throw error;
    }
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, username, role, subscription_tier, subscription_status,
            profile_image, stripe_customer_id, referral_code, referred_by, 
            created_at, updated_at
      FROM users WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Find user by email (for authentication)
  static async findByEmail(email: string): Promise<(User & { password: string }) | null> {
    const query = `
      SELECT id, email, username, password, role, subscription_tier, subscription_status,
            profile_image, stripe_customer_id, referral_code, referred_by,
            created_at, updated_at
      FROM users WHERE email = $1
    `;

    try {
      const result = await pool.query(query, [email]);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        ...this.mapRowToUser(row),
        password: row.password
      };
    } catch (error) {
      throw error;
    }
  }

  // Find user by username
  static async findByUsername(username: string): Promise<User | null> {
    const query = `
      SELECT id, email, username, role, subscription_tier, subscription_status,
            profile_image, stripe_customer_id, referral_code, referred_by,
            created_at, updated_at
      FROM users WHERE username = $1
    `;

    try {
      const result = await pool.query(query, [username]);
      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Update user
  static async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = this.camelToSnake(key);
        fields.push(`${dbField} = $${paramCount}`);
        values.push(value);
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
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, username, role, subscription_tier, 
                profile_image, stripe_customer_id, created_at, updated_at
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Delete user (soft delete)
  static async delete(id: string): Promise<boolean> {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const query = `
      UPDATE users 
      SET email = email || '_deleted_' || $2, updated_at = $3
      WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [id, Date.now(), new Date()]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // Get user statistics
  static async getStats(id: string) {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const query = `
      SELECT 
        (SELECT COUNT(*) FROM projects WHERE creator_id = $1) as total_projects,
        (SELECT COUNT(*) FROM project_collaborators WHERE user_id = $1) as total_collaborations,
        (SELECT COUNT(*) FROM annotations WHERE user_id = $1) as total_annotations,
        (SELECT COUNT(*) FROM projects WHERE creator_id = $1 AND status = 'completed') as completed_projects
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Search users (for collaboration invites)
  static async search(searchTerm: string, limit: number = 10): Promise<Partial<User>[]> {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const query = `
      SELECT id, username, email, role, profile_image
      FROM users 
      WHERE (username ILIKE $1 OR email ILIKE $1)
      AND email NOT LIKE '%_deleted_%'
      ORDER BY username
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [`%${searchTerm}%`, limit]);
      return result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        profileImage: row.profile_image
      }));
    } catch (error) {
      throw error;
    }
  }

  // Update subscription
  static async updateSubscription(
    id: string, 
    subscriptionTier: User['subscriptionTier'], 
    stripeCustomerId?: string
  ): Promise<User | null> {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const query = `
      UPDATE users 
      SET subscription_tier = $1, stripe_customer_id = $2, updated_at = $3
      WHERE id = $4
      RETURNING id, email, username, role, subscription_tier, 
                profile_image, stripe_customer_id, created_at, updated_at
    `;

    try {
      const result = await pool.query(query, [subscriptionTier, stripeCustomerId, new Date(), id]);
      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Generate referral code
  static async generateReferralCode(userId: string): Promise<string> {
     if (!pool) {
    console.error('❌ Database pool not available in UserModel.generateReferralCode');
    throw new Error('Database pool not initialized');
    }

    console.log('✅ Generating referral code for user:', userId);

    // Generate a unique referral code
    const referralCode = `REF_${userId.slice(0, 8)}_${Date.now().toString(36).toUpperCase()}`;

    const query = `
      UPDATE users 
      SET referral_code = $1, updated_at = $2
      WHERE id = $3
      RETURNING referral_code
    `;
    try {
    const result = await pool.query(query, [referralCode, new Date(), userId]);
    console.log('✅ Referral code generated:', result.rows[0].referral_code);
    return result.rows[0].referral_code;
  } catch (error) {
    console.error('❌ Error generating referral code:', error);
    throw error;
  }
}

  // Get referral stats
  static async getReferralStats(userId: string) {
    if (!pool) {
    console.error('❌ Database pool not available in UserModel.getReferralStats');
    throw new Error('Database pool not initialized');
    }
    console.log('✅ Getting referral stats for user:', userId);

    const query = `
      SELECT 
        u.referral_code,
        COUNT(CASE WHEN ref.subscription_tier != 'free' THEN 1 END) as successful_referrals,
        COUNT(CASE WHEN ref.subscription_tier = 'free' THEN 1 END) as pending_referrals,
        COUNT(CASE WHEN ref.subscription_tier != 'free' THEN 1 END) as rewards_earned
      FROM users u
      LEFT JOIN users ref ON ref.referred_by = u.referral_code
      WHERE u.id = $1
      GROUP BY u.referral_code
    `;

    try {
    const result = await pool.query(query, [userId]);
    const stats = result.rows[0] || {
      referral_code: null,
      successful_referrals: 0,
      pending_referrals: 0,
      rewards_earned: 0
    };
    console.log('✅ Referral stats retrieved:', stats);
    return stats;
  } catch (error) {
    console.error('❌ Error getting referral stats:', error);
    throw error;
  }
}

  // Check if username is available
  static async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    let query = 'SELECT id FROM users WHERE username = $1';
    const values = [username];

    if (excludeUserId) {
      query += ' AND id != $2';
      values.push(excludeUserId);
    }

    try {
      const result = await pool.query(query, values);
      return result.rows.length === 0;
    } catch (error) {
      throw error;
    }
  }

  // Check if email is available
  static async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    let query = 'SELECT id FROM users WHERE email = $1';
    const values = [email];

    if (excludeUserId) {
      query += ' AND id != $2';
      values.push(excludeUserId);
    }

    try {
      const result = await pool.query(query, values);
      return result.rows.length === 0;
    } catch (error) {
      throw error;
    }
  }

  // Helper method to map database row to User type
  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role,
      subscriptionTier: row.subscription_tier,
      profileImage: row.profile_image,
      stripe_customer_id: row.stripe_customer_id,
      referralCode: row.referral_code,
      referredBy: row.referred_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Helper method to convert camelCase to snake_case
  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

// Convenience functions for backward compatibility with your existing auth routes
export const createUser = (userData: CreateUserData) => UserModel.create(userData);
export const findUserById = (id: string) => UserModel.findById(id);
export const findUserByEmail = (email: string) => UserModel.findByEmail(email);
export const findUserByUsername = (username: string) => UserModel.findByUsername(username);
export const updateUser = (id: string, updateData: UpdateUserData) => UserModel.update(id, updateData);
export const deleteUser = (id: string) => UserModel.delete(id);
export const getUserStats = (id: string) => UserModel.getStats(id);
export const searchUsers = (searchTerm: string, limit: number = 10) => UserModel.search(searchTerm, limit);
export const updateUserSubscription = (id: string, subscriptionTier: User['subscriptionTier'], stripeCustomerId?: string) =>
  UserModel.updateSubscription(id, subscriptionTier, stripeCustomerId);
export const generateReferralCode = (userId: string) => UserModel.generateReferralCode(userId);