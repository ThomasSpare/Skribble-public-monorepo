// backend/src/services/s3-upload.ts
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

class S3UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'skribble-audio-files';
  }

  /**
   * Get the appropriate S3 folder based on file type
   */
  private getS3Folder(mimeType: string, fileType?: 'audio' | 'image'): string {
    if (fileType) {
      return fileType === 'audio' ? 'audio' : 'images';
    }
    
    // Auto-detect based on mime type
    if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else if (mimeType.startsWith('image/')) {
      return 'images';
    }
    
    return 'files'; // fallback (shouldn't be used)
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
    
    // Validate that we have the right parameters for the use case
    const isAudio = mimeType.startsWith('audio/');
    const isImage = mimeType.startsWith('image/');
    
    if (isAudio && !options.projectId) {
      throw new Error('projectId is required for audio uploads');
    }
    
    if (isImage && !options.userId) {
      throw new Error('userId is required for image uploads');
    }
    
    // Generate S3 key for your specific structure
    const key = this.generateS3Key(originalName, options);

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

    await this.s3Client.send(command);

    return {
      key,
      location: `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      bucket: this.bucketName
    };
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
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    await this.s3Client.send(command);
  }

  /**
   * Generate signed URL for secure file access
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Check if S3 is properly configured
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to list objects to test connection
      const testKey = `test/${uuidv4()}.txt`;
      const testBuffer = Buffer.from('connection test');
      
      await this.uploadBuffer(testBuffer, 'test.txt', 'text/plain', {
        projectId: 'test-project'
      });
      await this.deleteFile(testKey);
      
      return true;
    } catch (error) {
      console.error('S3 connection test failed:', error);
      return false;
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        metadata: response.Metadata
      };
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return null;
    }
  }
}

export const s3UploadService = new S3UploadService();
export default S3UploadService;