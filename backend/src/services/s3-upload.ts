// backend/src/services/s3-upload.ts - FIXED VERSION
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  key: string;
  location: string;
  bucket: string;
}

const logWithTimestamp = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] S3Service: ${message}`, data || '');
};

class S3UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // FIXED: Add validation for required environment variables
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
      logWithTimestamp('❌ Missing required AWS environment variables:', {
        hasRegion: !!region,
        hasAccessKey: !!accessKeyId,
        hasSecretKey: !!secretAccessKey,
        hasBucketName: !!bucketName
      });
      throw new Error('Missing required AWS environment variables');
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.bucketName = bucketName;

    logWithTimestamp('✅ S3UploadService initialized', {
      region,
      bucket: bucketName,
      accessKeyId: accessKeyId.substring(0, 6) + '...'
    });
  }

  /**
   * Generate S3 key for your specific use cases
   */
  private generateS3Key(
    originalName: string,
    options: {
      projectId?: string;
      userId?: string;
      includeOriginalName?: boolean;
    }
  ): string {
    const ext = path.extname(originalName);
    const uuid = uuidv4();
    
    // Sanitize original filename for use in S3 key
    const sanitizedName = path.basename(originalName, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '-')  // Replace special chars with dashes
      .replace(/-+/g, '-')  // Collapse multiple dashes
      .substring(0, 50)  // Limit length
      .replace(/^-|-$/g, '');  // Remove leading/trailing dashes

    let filename: string;
    
    if (options?.includeOriginalName && sanitizedName) {
      // Include both UUID and original name: uuid-original-name.ext
      filename = `${uuid.substring(0, 8)}-${sanitizedName}${ext}`;
    } else {
      // Just UUID: uuid.ext (current approach)
      filename = `${uuid}${ext}`;
    }

    // Two specific use cases only:
    if (options.projectId) {
      // All audio files go in: projects/{project-id}/audio/{file}
      return `projects/${options.projectId}/audio/${filename}`;
    } else if (options.userId) {
      // All profile images go in: users/{user-id}/images/{file}  
      return `users/${options.userId}/images/${filename}`;
    } else {
      // This shouldn't happen in your current workflow
      throw new Error('Either projectId (for audio) or userId (for images) must be provided');
    }
  }

  /**
   * Upload file buffer to S3 - simplified for your specific use cases
   */
  async uploadBuffer(
    buffer: Buffer, 
    originalName: string, 
    mimeType: string,
    options: {
      projectId?: string;      // For audio files (required for audio)
      userId?: string;         // For profile images (required for images)
      includeOriginalName?: boolean;
    }
  ): Promise<UploadResult> {
    
    logWithTimestamp('🚀 Starting S3 upload:', {
      originalName,
      mimeType,
      bufferSize: buffer.length,
      options
    });

    // Validate that we have the right parameters for the use case
    const isAudio = mimeType.startsWith('audio/');
    const isImage = mimeType.startsWith('image/');
    
    if (isAudio && !options.projectId) {
      throw new Error('projectId is required for audio uploads');
    }
    
    if (isImage && !options.userId) {
      throw new Error('userId is required for image uploads');
    }

    // FIXED: Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Invalid buffer: empty or null');
    }
    
    // Generate S3 key for your specific structure
    const key = this.generateS3Key(originalName, options);
    logWithTimestamp('🔑 Generated S3 key:', key);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          originalName: originalName,
          uploadedAt: new Date().toISOString(),
          projectId: options.projectId || 'none',
          userId: options.userId || 'none',
          fileType: isAudio ? 'audio' : isImage ? 'image' : 'unknown'
        }
      });

      logWithTimestamp('📤 Sending to S3...', {
        bucket: this.bucketName,
        key: key,
        contentType: mimeType
      });

      const result = await this.s3Client.send(command);
      
      logWithTimestamp('✅ S3 upload successful:', {
        key,
        etag: result.ETag,
        versionId: result.VersionId
      });

      const uploadResult = {
        key,
        location: `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
        bucket: this.bucketName
      };

      logWithTimestamp('📋 Returning upload result:', uploadResult);
      return uploadResult;

    } catch (error) {
      logWithTimestamp('❌ S3 upload failed:', {
        error: error.message,
        code: error.code,
        key,
        bucket: this.bucketName
      });
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Upload file from local path to S3
   */
  async uploadFile(
    filePath: string, 
    originalName: string, 
    mimeType: string,
    options: {
      projectId?: string;      // For audio files
      userId?: string;         // For profile images  
      includeOriginalName?: boolean;
    }
  ): Promise<UploadResult> {
    const fileBuffer = fs.readFileSync(filePath);
    return this.uploadBuffer(fileBuffer, originalName, mimeType, options);
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      logWithTimestamp('🗑️ Deleting file from S3:', key);
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
      logWithTimestamp('✅ File deleted successfully:', key);
    } catch (error) {
      logWithTimestamp('❌ Failed to delete file:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Generate signed URL for secure file access
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      logWithTimestamp('🔗 Generating signed URL:', { key, expiresIn });
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      logWithTimestamp('✅ Signed URL generated successfully');
      return signedUrl;
    } catch (error) {
      logWithTimestamp('❌ Failed to generate signed URL:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Get file content directly as Buffer from S3
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    try {
      logWithTimestamp('📥 Getting file content from S3:', { key });
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No file content received from S3');
      }

      // Convert response body to buffer using AWS SDK v3 method
      const streamToBuffer = async (stream: any): Promise<Buffer> => {
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      };

      const buffer = await streamToBuffer(response.Body);
      logWithTimestamp('✅ File content retrieved successfully:', { size: buffer.length });
      return buffer;
    } catch (error) {
      logWithTimestamp('❌ Failed to get file content:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Check if S3 is properly configured
   * FIXED: Use correct key for deletion
   */
  async testConnection(): Promise<boolean> {
    try {
      logWithTimestamp('🧪 Testing S3 connection...');
      
      // Create a unique test key
      const testKey = `test/connection-test-${uuidv4()}.txt`;
      const testBuffer = Buffer.from('S3 connection test');
      
      // FIXED: Upload with a simple structure for testing
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
        Body: testBuffer,
        ContentType: 'text/plain',
        Metadata: {
          test: 'true',
          timestamp: new Date().toISOString()
        }
      });

      await this.s3Client.send(command);
      logWithTimestamp('✅ Test upload successful');
      
      // Now delete using the same key
      await this.deleteFile(testKey);
      logWithTimestamp('✅ Test cleanup successful');
      
      return true;
    } catch (error) {
      logWithTimestamp('❌ S3 connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(key: string) {
    try {
      logWithTimestamp('📊 Getting file metadata:', key);
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      const metadata = {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        metadata: response.Metadata
      };

      logWithTimestamp('✅ Metadata retrieved:', metadata);
      return metadata;
    } catch (error) {
      logWithTimestamp('❌ Failed to get file metadata:', { key, error: error.message });
      return null;
    }
  }

  /**
   * ADDED: Check if file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.getFileMetadata(key);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const s3UploadService = new S3UploadService();
export default S3UploadService;