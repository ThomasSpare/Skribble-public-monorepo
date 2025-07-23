import { s3UploadService } from '../services/s3-upload';

export class S3ImageProcessor {
  /**
   * Process a profile image URL to generate signed URLs for S3 images
   * @param profileImageUrl - The original profile image URL
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns Promise<string | null> - Signed URL or null if invalid/error
   */
  static async processProfileImage(profileImageUrl: string | null | undefined, expiresIn: number = 3600): Promise<string | null> {
    if (!profileImageUrl) {
      return null;
    }

    // If it's not an S3 URL, return as-is
    if (!profileImageUrl.includes('s3')) {
      return profileImageUrl;
    }

    // If it's already a signed URL, return as-is
    if (profileImageUrl.includes('X-Amz-')) {
      return profileImageUrl;
    }

    try {
      const url = new URL(profileImageUrl);
      const s3Key = url.pathname.substring(1); // Remove leading slash
      
      // Validate S3 key format
      if (!this.isValidS3Key(s3Key)) {
        console.warn('Invalid S3 key format:', s3Key);
        return null;
      }

      const signedUrl = await s3UploadService.getSignedDownloadUrl(s3Key, expiresIn);
      
      if (signedUrl && signedUrl.includes('X-Amz-')) {
        return signedUrl;
      } else {
        console.warn('Failed to generate valid signed URL for:', s3Key);
        return null;
      }
    } catch (error) {
      console.error('Error processing S3 profile image URL:', error);
      return null;
    }
  }

  /**
   * Process multiple profile images in parallel
   * @param imageUrls - Array of profile image URLs
   * @param expiresIn - Expiration time in seconds
   * @returns Promise<(string | null)[]> - Array of processed URLs
   */
  static async processMultipleProfileImages(imageUrls: (string | null | undefined)[], expiresIn: number = 3600): Promise<(string | null)[]> {
    return Promise.all(
      imageUrls.map(url => this.processProfileImage(url, expiresIn))
    );
  }

  /**
   * Validate S3 key format for profile images
   * @param s3Key - The S3 key to validate
   * @returns boolean - Whether the key is valid
   */
  private static isValidS3Key(s3Key: string): boolean {
    return Boolean(
      s3Key &&
      !s3Key.includes('undefined') &&
      !s3Key.includes('null') &&
      s3Key.includes('users/') &&
      s3Key.length > 10
    );
  }

  /**
   * Process user object with profile image
   * @param user - User object that may contain profile_image
   * @param expiresIn - Expiration time in seconds
   * @returns Promise<any> - User object with processed profile image
   */
  static async processUserWithProfileImage(user: any, expiresIn: number = 3600): Promise<any> {
    if (!user) return user;

    const processedImage = await this.processProfileImage(user.profile_image || user.profileImage, expiresIn);
    
    return {
      ...user,
      profileImage: processedImage,
      profile_image: processedImage // Support both naming conventions
    };
  }

  /**
   * Process array of users with profile images
   * @param users - Array of user objects
   * @param expiresIn - Expiration time in seconds
   * @returns Promise<any[]> - Array of users with processed profile images
   */
  static async processUsersWithProfileImages(users: any[], expiresIn: number = 3600): Promise<any[]> {
    return Promise.all(
      users.map(user => this.processUserWithProfileImage(user, expiresIn))
    );
  }
}
