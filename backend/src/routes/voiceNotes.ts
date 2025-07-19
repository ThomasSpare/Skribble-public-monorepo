// backend/src/routes/voiceNotes.ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { body, param, validationResult } from 'express-validator';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';

const router = express.Router();

// Configure AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Configure multer for memory storage (mobile-friendly)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for voice notes
  },
  fileFilter: (req, file, cb) => {
    // Accept various audio formats that mobile devices might use
    const allowedMimes = [
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/m4a'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format for voice note'));
    }
  }
});

/**
 * Convert audio to standardized format for consistency
 * Mobile recordings can be in various formats - normalize to MP3
 */
async function convertToStandardFormat(
  inputBuffer: Buffer, 
  originalMimetype: string
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const tempDir = os.tmpdir();
    const inputId = uuidv4();
    const outputId = uuidv4();
    
    // Determine input extension based on mimetype
    let inputExt = '.webm';
    if (originalMimetype.includes('mp4')) inputExt = '.mp4';
    else if (originalMimetype.includes('mpeg')) inputExt = '.mp3';
    else if (originalMimetype.includes('wav')) inputExt = '.wav';
    else if (originalMimetype.includes('ogg')) inputExt = '.ogg';
    
    const inputPath = path.join(tempDir, `voice_input_${inputId}${inputExt}`);
    const outputPath = path.join(tempDir, `voice_output_${outputId}.mp3`);
    
    try {
      // Write input buffer to temp file
      await fs.writeFile(inputPath, inputBuffer);
      
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(128) // Good quality for voice
        .audioChannels(1)  // Mono for voice notes
        .audioFrequency(44100)
        .format('mp3')
        .on('end', async () => {
          try {
            const outputBuffer = await fs.readFile(outputPath);
            
            // Cleanup temp files
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            
            resolve(outputBuffer);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', async (error) => {
          // Cleanup on error
          await fs.unlink(inputPath).catch(() => {});
          await fs.unlink(outputPath).catch(() => {});
          reject(error);
        })
        .save(outputPath);
        
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Upload voice note and create annotation
 * POST /api/voice-notes/upload
 */
router.post('/upload', [
  authenticateToken,
  upload.single('voiceNote'),
  body('audioFileId').isUUID().withMessage('Valid audio file ID required'),
  body('timestamp').isFloat({ min: 0 }).withMessage('Valid timestamp required'),
  body('text').optional().isString().trim(),
  body('annotationType').optional().isIn(['voice', 'comment']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Validation failed', 
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Voice note file is required',
          code: 'MISSING_FILE'
        }
      });
    }

    const { audioFileId, timestamp, text, annotationType, priority } = req.body;
    const userId = req.user!.userId;
    
    console.log('📱 Voice note upload request:', {
      audioFileId,
      timestamp,
      originalMimetype: req.file.mimetype,
      fileSize: req.file.size,
      userId
    });

    // Verify user has access to the audio file
    const { pool } = await import('../config/database');
    const accessCheck = await pool.query(`
      SELECT af.id, p.creator_id, pc.user_id as collaborator_id
      FROM audio_files af
      JOIN projects p ON af.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE af.id = $1 AND (p.creator_id = $2 OR pc.user_id = $2)
    `, [audioFileId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { 
          message: 'Access denied to this audio file',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Convert audio to standard format (MP3)
    console.log('🔄 Converting voice note to standard format...');
    const convertedBuffer = await convertToStandardFormat(
      req.file.buffer, 
      req.file.mimetype
    );

    // Generate unique filename for S3
    const voiceNoteId = uuidv4();
    const s3Key = `voice-notes/${audioFileId}/${voiceNoteId}.mp3`;
    
    // Upload to S3
    console.log('☁️ Uploading to S3:', s3Key);
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: s3Key,
      Body: convertedBuffer,
      ContentType: 'audio/mpeg',
      Metadata: {
        originalMimetype: req.file.mimetype,
        audioFileId: audioFileId,
        userId: userId,
        timestamp: timestamp.toString(),
        uploadedAt: new Date().toISOString()
      }
    });

    await s3Client.send(uploadCommand);
    
    // Generate voice note URL
    const voiceNoteUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    
    // Create annotation with voice note
    const { AnnotationModel } = await import('../models/Annotation');
    const annotation = await AnnotationModel.create({
      audioFileId,
      userId,
      timestamp: parseFloat(timestamp),
      text: text || `Voice note at ${Math.floor(timestamp / 60)}:${(timestamp % 60).toFixed(0).padStart(2, '0')}`,
      voiceNoteUrl,
      annotationType: annotationType || 'voice',
      priority: priority || 'medium',
      status: 'pending'
    });

    console.log('✅ Voice note annotation created:', annotation.id);

    res.status(201).json({
      success: true,
      data: {
        annotation,
        voiceNoteUrl,
        message: 'Voice note uploaded and annotation created successfully'
      }
    });

  } catch (error) {
    console.error('❌ Voice note upload error:', error);
    
    let errorMessage = 'Failed to upload voice note';
    let errorCode = 'UPLOAD_ERROR';
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid audio format')) {
        errorMessage = 'Unsupported audio format';
        errorCode = 'UNSUPPORTED_FORMAT';
      } else if (error.message.includes('File too large')) {
        errorMessage = 'Voice note file too large (max 10MB)';
        errorCode = 'FILE_TOO_LARGE';
      } else if (error.message.includes('ffmpeg')) {
        errorMessage = 'Audio processing failed';
        errorCode = 'PROCESSING_ERROR';
      }
    }
    
    res.status(500).json({
      success: false,
      error: { 
        message: errorMessage,
        code: errorCode
      }
    });
  }
});

/**
 * Get voice note for playback
 * GET /api/voice-notes/:annotationId
 */
router.get('/:annotationId', [
  authenticateToken,
  param('annotationId').isUUID()
], async (req: Request, res: Response) => {
  try {
    const { annotationId } = req.params;
    const userId = req.user!.userId;
    
    // Verify user has access to this annotation
    const { pool } = await import('../config/database');
    const annotationCheck = await pool.query(`
      SELECT a.voice_note_url, af.id as audio_file_id, p.creator_id, pc.user_id as collaborator_id
      FROM annotations a
      JOIN audio_files af ON a.audio_file_id = af.id
      JOIN projects p ON af.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
      WHERE a.id = $1 AND a.voice_note_url IS NOT NULL 
      AND (p.creator_id = $2 OR pc.user_id = $2)
    `, [annotationId, userId]);

    if (annotationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { 
          message: 'Voice note not found or access denied',
          code: 'NOT_FOUND'
        }
      });
    }

    const { voice_note_url } = annotationCheck.rows[0];
    
    res.json({
      success: true,
      data: {
        voiceNoteUrl: voice_note_url,
        annotationId
      }
    });

  } catch (error) {
    console.error('❌ Voice note fetch error:', error);
    res.status(500).json({
      success: false,
      error: { 
        message: 'Failed to fetch voice note',
        code: 'FETCH_ERROR'
      }
    });
  }
});

/**
 * Delete voice note
 * DELETE /api/voice-notes/:annotationId
 */
router.delete('/:annotationId', [
  authenticateToken,
  param('annotationId').isUUID()
], async (req: Request, res: Response) => {
  try {
    const { annotationId } = req.params;
    const userId = req.user!.userId;
    
    // Verify user owns this annotation or has admin access
    const { pool } = await import('../config/database');
    const annotationCheck = await pool.query(`
      SELECT a.voice_note_url, a.user_id, af.id as audio_file_id, p.creator_id
      FROM annotations a
      JOIN audio_files af ON a.audio_file_id = af.id
      JOIN projects p ON af.project_id = p.id
      WHERE a.id = $1 AND a.voice_note_url IS NOT NULL
    `, [annotationId]);

    if (annotationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { 
          message: 'Voice note not found',
          code: 'NOT_FOUND'
        }
      });
    }

    const { voice_note_url, user_id: annotationUserId, creator_id } = annotationCheck.rows[0];
    
    // Only annotation owner or project creator can delete
    if (annotationUserId !== userId && creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { 
          message: 'Not authorized to delete this voice note',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Extract S3 key from URL
    const urlParts = voice_note_url.split('/');
    const s3Key = urlParts.slice(3).join('/'); // Remove https://bucket.s3.region.amazonaws.com/
    
    // Delete from S3 (optional - you might want to keep for audit)
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: s3Key
      });
      await s3Client.send(deleteCommand);
    } catch (s3Error) {
      console.warn('⚠️ Failed to delete voice note from S3:', s3Error);
      // Continue anyway - the annotation will be updated
    }

    // Update annotation to remove voice note URL
    await pool.query(`
      UPDATE annotations 
      SET voice_note_url = NULL, updated_at = NOW()
      WHERE id = $1
    `, [annotationId]);

    res.json({
      success: true,
      data: { message: 'Voice note deleted successfully' }
    });

  } catch (error) {
    console.error('❌ Voice note deletion error:', error);
    res.status(500).json({
      success: false,
      error: { 
        message: 'Failed to delete voice note',
        code: 'DELETE_ERROR'
      }
    });
  }
});

export default router;