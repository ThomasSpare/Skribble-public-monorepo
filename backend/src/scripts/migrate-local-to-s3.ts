// backend/src/scripts/migrate-local-to-s3.ts
// Script to migrate existing local files to S3
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { s3UploadService } from '../services/s3-upload';

interface AudioFile {
  id: string;
  filename: string;
  original_filename: string;
  file_url: string;
  project_id: string;
  mime_type: string;
  file_size: number;
  storage_type: string;
}

interface UserProfile {
  id: string;
  username: string;
  profileImage: string;  // Fixed: column is 'profile_image' not 'profile_image_url'
  storage_type: string;
}

const logWithTimestamp = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

class LocalToS3Migration {
  private uploadDirAudio: string;
  private uploadDirImages: string;
  private migratedCount = 0;
  private failedCount = 0;
  private skippedCount = 0;

  constructor() {
    this.uploadDirAudio = path.resolve(process.cwd(), 'uploads', 'audio');
    this.uploadDirImages = path.resolve(process.cwd(), 'uploads', 'images');
  }

  async run(dryRun: boolean = true) {
    logWithTimestamp('🚀 Starting Comprehensive Local to S3 Migration');
    logWithTimestamp(`📁 Audio directory: ${this.uploadDirAudio}`);
    logWithTimestamp(`🖼️ Images directory: ${this.uploadDirImages}`);
    logWithTimestamp(`🔍 Dry run mode: ${dryRun}`);

    try {
      // Test S3 connection first
      const isS3Connected = await s3UploadService.testConnection();
      if (!isS3Connected) {
        throw new Error('S3 connection test failed. Check your AWS credentials.');
      }
      logWithTimestamp('✅ S3 connection successful');

      // Get all local files from database
      const localAudioFiles = await this.getLocalAudioFiles();
      const localImageFiles = await this.getLocalImageFiles();
      
      logWithTimestamp(`📊 Found ${localAudioFiles.length} audio files to migrate`);
      logWithTimestamp(`📊 Found ${localImageFiles.length} image files to migrate`);

      const totalFiles = localAudioFiles.length + localImageFiles.length;
      if (totalFiles === 0) {
        logWithTimestamp('ℹ️ No local files found to migrate');
        return;
      }

      // Process audio files
      logWithTimestamp('🎵 Processing audio files...');
      for (const file of localAudioFiles) {
        await this.migrateAudioFile(file, dryRun);
      }

      // Process image files
      logWithTimestamp('🖼️ Processing image files...');
      for (const file of localImageFiles) {
        await this.migrateImageFile(file, dryRun);
      }

      // Summary
      logWithTimestamp('📈 Migration Summary:', {
        total: totalFiles,
        migrated: this.migratedCount,
        failed: this.failedCount,
        skipped: this.skippedCount
      });

      if (!dryRun) {
        logWithTimestamp('✅ Migration completed successfully');
        logWithTimestamp('💡 You can now update your upload routes to use S3');
      } else {
        logWithTimestamp('ℹ️ Dry run completed. Run with --execute to perform actual migration');
      }

    } catch (error) {
      logWithTimestamp('❌ Migration failed:', error);
      throw error;
    }
  }

  private async getLocalAudioFiles(): Promise<AudioFile[]> {
    // Use uploaded_at (which exists) instead of created_at (which doesn't exist)
    const result = await pool.query(`
      SELECT id, filename, original_filename, file_url, project_id, 
             mime_type, file_size, storage_type
      FROM audio_files 
      WHERE storage_type = 'local' OR storage_type IS NULL
      ORDER BY uploaded_at ASC
    `);

    return result.rows;
  }

  private async getLocalImageFiles(): Promise<UserProfile[]> {
    // Get users with local profile images (column is 'profile_image' not 'profile_image_url')
    // Use created_at (which exists in users table)
    const result = await pool.query(`
      SELECT id, username, profile_image as "profileImage",
             CASE WHEN profile_image LIKE '/uploads/images/%' THEN 'local' ELSE 'unknown' END as storage_type
      FROM users 
      WHERE profile_image IS NOT NULL 
        AND profile_image LIKE '/uploads/images/%'
      ORDER BY created_at ASC
    `);

    return result.rows;
  }

  private async migrateAudioFile(file: AudioFile, dryRun: boolean) {
    const fileDisplayName = file.original_filename || file.filename;
    logWithTimestamp(`🎵 Processing audio: ${fileDisplayName}`);

    try {
      // Construct local file path
      const localPath = path.join(this.uploadDirAudio, file.filename);
      
      // Check if local file exists
      if (!fs.existsSync(localPath)) {
        logWithTimestamp(`⚠️ Local audio file not found: ${localPath}`);
        this.skippedCount++;
        return;
      }

      // Get file stats
      const stats = fs.statSync(localPath);
      logWithTimestamp(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      if (dryRun) {
        logWithTimestamp(`🔍 [DRY RUN] Would migrate audio ${fileDisplayName} to S3`);
        this.migratedCount++;
        return;
      }

      // Upload to S3
      logWithTimestamp(`🚀 Uploading audio to S3...`);
      const s3Result = await s3UploadService.uploadFile(
        localPath,
        file.original_filename || file.filename,
        file.mime_type || 'audio/mpeg',
        { 
          projectId: file.project_id,
          includeOriginalName: process.env.S3_INCLUDE_ORIGINAL_NAME === 'true'  // Configurable
        }
      );

      // Update database record
      await pool.query(`
        UPDATE audio_files 
        SET 
          s3_key = $1,
          s3_bucket = $2,
          file_url = $3,
          storage_type = 's3',
          metadata = $4
        WHERE id = $5
      `, [
        s3Result.key,
        s3Result.bucket,
        s3Result.location,
        JSON.stringify({
          migratedAt: new Date().toISOString(),
          originalPath: localPath,
          originalSize: stats.size,
          fileType: 'audio'
        }),
        file.id
      ]);

      logWithTimestamp(`✅ Successfully migrated audio: ${fileDisplayName}`);
      logWithTimestamp(`📍 S3 Key: ${s3Result.key}`);
      
      this.migratedCount++;

    } catch (error) {
      logWithTimestamp(`❌ Failed to migrate audio ${fileDisplayName}:`, error);
      this.failedCount++;
    }
  }

  private async migrateImageFile(user: UserProfile, dryRun: boolean) {
    logWithTimestamp(`🖼️ Processing image for user: ${user.username}`);

    try {
      // Extract filename from URL path (e.g., /uploads/images/profile-123.jpg -> profile-123.jpg)
      const urlPath = user.profileImage;  // Fixed: use correct property name
      const filename = path.basename(urlPath);
      const localPath = path.join(this.uploadDirImages, filename);
      
      // Check if local file exists
      if (!fs.existsSync(localPath)) {
        logWithTimestamp(`⚠️ Local image file not found: ${localPath}`);
        this.skippedCount++;
        return;
      }

      // Get file stats and detect mime type
      const stats = fs.statSync(localPath);
      const ext = path.extname(filename).toLowerCase();
      let mimeType = 'image/jpeg'; // default
      
      switch (ext) {
        case '.png': mimeType = 'image/png'; break;
        case '.webp': mimeType = 'image/webp'; break;
        case '.gif': mimeType = 'image/gif'; break;
        case '.jpg':
        case '.jpeg': mimeType = 'image/jpeg'; break;
      }

      logWithTimestamp(`📊 Image size: ${(stats.size / 1024).toFixed(2)} KB`);

      if (dryRun) {
        logWithTimestamp(`🔍 [DRY RUN] Would migrate image ${filename} to S3`);
        this.migratedCount++;
        return;
      }

      // Upload to S3
      logWithTimestamp(`🚀 Uploading image to S3...`);
      const s3Result = await s3UploadService.uploadFile(
        localPath,
        filename,
        mimeType,
        { 
          userId: user.id,
          includeOriginalName: process.env.S3_INCLUDE_ORIGINAL_NAME === 'true'  // Configurable
        }
      );

      // Update user profile with new S3 URL (use correct column name: profile_image)
      await pool.query(`
        UPDATE users 
        SET profile_image = $1
        WHERE id = $2
      `, [s3Result.location, user.id]);

      logWithTimestamp(`✅ Successfully migrated image for: ${user.username}`);
      logWithTimestamp(`📍 S3 Key: ${s3Result.key}`);
      
      this.migratedCount++;

    } catch (error) {
      logWithTimestamp(`❌ Failed to migrate image for ${user.username}:`, error);
      this.failedCount++;
    }
  }

  async cleanupLocalFiles() {
    logWithTimestamp('🧹 Starting comprehensive local file cleanup');

    try {
      // Clean up audio files
      await this.cleanupAudioFiles();
      
      // Clean up image files
      await this.cleanupImageFiles();

    } catch (error) {
      logWithTimestamp('❌ Cleanup failed:', error);
      throw error;
    }
  }

  private async cleanupAudioFiles() {
    logWithTimestamp('🎵 Cleaning up audio files...');
    
    // Get all S3 audio files
    const s3AudioFiles = await pool.query(`
      SELECT filename, file_url, s3_key
      FROM audio_files 
      WHERE storage_type = 's3' AND s3_key IS NOT NULL
    `);

    logWithTimestamp(`📊 Found ${s3AudioFiles.rows.length} S3 audio files`);

    let cleanedCount = 0;
    
    for (const file of s3AudioFiles.rows) {
      const localPath = path.join(this.uploadDirAudio, file.filename);
      
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
          logWithTimestamp(`🗑️ Removed audio: ${file.filename}`);
          cleanedCount++;
        } catch (error) {
          logWithTimestamp(`⚠️ Failed to remove audio ${file.filename}:`, error);
        }
      }
    }

    logWithTimestamp(`✅ Audio cleanup completed. Removed ${cleanedCount} files`);
  }

  private async cleanupImageFiles() {
    logWithTimestamp('🖼️ Cleaning up image files...');
    
    // Get all users with S3 profile images (use correct column name: profile_image)
    const s3ImageUsers = await pool.query(`
      SELECT username, profile_image
      FROM users 
      WHERE profile_image IS NOT NULL 
        AND profile_image LIKE 'https://%s3%'
    `);

    logWithTimestamp(`📊 Found ${s3ImageUsers.rows.length} users with S3 images`);

    let cleanedCount = 0;
    
    // Also clean up any remaining files in the images directory
    if (fs.existsSync(this.uploadDirImages)) {
      const imageFiles = fs.readdirSync(this.uploadDirImages);
      
      for (const filename of imageFiles) {
        const localPath = path.join(this.uploadDirImages, filename);
        
        try {
          fs.unlinkSync(localPath);
          logWithTimestamp(`🗑️ Removed image: ${filename}`);
          cleanedCount++;
        } catch (error) {
          logWithTimestamp(`⚠️ Failed to remove image ${filename}:`, error);
        }
      }
    }

    logWithTimestamp(`✅ Image cleanup completed. Removed ${cleanedCount} files`);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const migration = new LocalToS3Migration();

  switch (command) {
    case '--execute':
      migration.run(false);
      break;
    case '--cleanup':
      migration.cleanupLocalFiles();
      break;
    case '--help':
      console.log(`
Usage: ts-node migrate-local-to-s3.ts [command]

Commands:
  (no args)    Run dry-run migration (shows what would be migrated)
  --execute    Execute actual migration to S3
  --cleanup    Remove local files after successful S3 migration
  --help       Show this help message

Examples:
  npm run migrate:s3              # Dry run
  npm run migrate:s3 --execute    # Execute migration
  npm run migrate:s3 --cleanup    # Clean up local files
      `);
      break;
    default:
      migration.run(true); // Default to dry run
  }
}

export { LocalToS3Migration };