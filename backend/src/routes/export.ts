// backend/src/routes/export.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { s3UploadService } from '../services/s3-upload';
import { pool } from '../config/database';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs';
import path from 'path';
import os from 'os';

const writeFileAsync = promisify(writeFile);
const unlinkAsync = promisify(unlink);

// Set FFmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const router = express.Router();


interface DAWMarker {
  timestamp: number;
  label: string;
  type: 'cue' | 'marker' | 'region';
  color?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  annotationType?: string;
  userId?: string;
  username?: string;
  fullText?: string; // Store original full text for detailed views
}

/**
 * POST /export/wav-with-cues
 * Convert audio file to WAV with embedded cue points
 */
router.post('/wav-with-cues', authenticateToken, async (req: any, res: any) => {
  try {
    const { audioFileId, annotations, projectTitle, format } = req.body;
    const userId = req.user.userId;

    // Export WAV with cues request

    // Validate input
    if (!audioFileId || !annotations || !projectTitle) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: audioFileId, annotations, projectTitle' }
      });
    }

    // Get audio file info from database
    // The audioFileId from frontend is actually the S3 filename part, not the database ID
    // Query database for audio file
    
    const audioFileQuery = `
      SELECT af.*, p.creator_id, p.title as project_title
      FROM audio_files af 
      JOIN projects p ON af.project_id = p.id 
      WHERE af.s3_key LIKE '%' || $1 || '%'
    `;
    
    const audioFileResult = await pool.query(audioFileQuery, [audioFileId]);
    

    
    if (audioFileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Audio file not found' }
      });
    }

    const audioFile = audioFileResult.rows[0];

    // Check permissions (must be project creator or collaborator)
    const permissionQuery = `
      SELECT 1 FROM projects p 
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id 
      WHERE p.id = $1 AND (p.creator_id = $2 OR pc.user_id = $2)
    `;
    
    const permissionResult = await pool.query(permissionQuery, [audioFile.project_id, userId]);
    
    if (permissionResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: You do not have permission to export this audio file' }
      });
    }

    // Check if file has S3 key
    if (!audioFile.s3_key) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Audio file not stored in S3 - cannot process for export',
          details: 'This file was uploaded before S3 migration. Please re-upload the file.'
        }
      });
    }

    // Download the original audio file using signed URL approach (more reliable)
    // Download audio file from S3
    const signedUrl = await s3UploadService.getSignedDownloadUrl(audioFile.s3_key, 3600);
    
    // Use https module for server-side download
    const https = require('https');
    const http = require('http');
    
    const downloadFile = (url: string): Promise<Buffer> => {
      return new Promise((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http;
        
        client.get(url, (response: any) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }
          
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
          response.on('error', reject);
        }).on('error', reject);
      });
    };
    
    const audioBuffer = await downloadFile(signedUrl);
    // Audio file downloaded successfully

    // Generate DAW markers from annotations
    const markers = generateDAWMarkersFromAnnotations(annotations);

    // Check if the file is already WAV format
    const isWAV = audioFile.mime_type === 'audio/wav' || audioFile.filename.toLowerCase().endsWith('.wav');
    
    let processedAudio: Buffer;
    
    if (isWAV && markers.length > 0) {
      // Embed cue points directly into existing WAV file
      // Embed cue points into existing WAV file
      processedAudio = embedCuePointsInWAV(audioBuffer, markers, audioFile.sample_rate || 44100);
    } else if (isWAV) {
      // Return original WAV file if no markers to embed
      // Return original WAV file (no markers to embed)
      processedAudio = audioBuffer;
    } else {
      // Convert non-WAV files to WAV format first, then embed cue points
      // Convert to WAV with embedded cue points
      processedAudio = await convertToWAVWithCuePoints(audioBuffer, markers, audioFile.sample_rate || 44100);
    }

    const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    
    // Check if there are voice notes to create a voice track
    const voiceNotes = annotations.filter(ann => ann.voiceNoteUrl && ann.voiceNoteUrl.trim());
    
    if (voiceNotes.length > 0) {
      // Create individual voice note tracks
      
      // Create individual voice note tracks
      const voiceNoteTracks = await createIndividualVoiceNoteTracks(
        voiceNotes, 
        processedAudio, 
        audioFile.sample_rate || 44100,
        sanitizedTitle
      );
      
      // Return JSON with all files as base64 for frontend to handle individual downloads
      const files = [
        {
          filename: `${sanitizedTitle}.wav`,
          content: processedAudio.toString('base64'),
          type: 'main'
        },
        ...voiceNoteTracks.map((track, index) => ({
          filename: track.filename,
          content: track.buffer.toString('base64'),
          type: 'voice'
        }))
      ];
      
      res.json({
        success: true,
        files: files,
        message: `Created ${voiceNoteTracks.length + 1} WAV files`
      });
    } else {
      // No voice notes - send single WAV file as before
      const filename = `${sanitizedTitle}.wav`;
      
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', processedAudio.length);
      res.setHeader('Cache-Control', 'no-cache');
      
      // Send WAV file with embedded cue points
      res.send(processedAudio);
    }

  } catch (error) {
    console.error('❌ Export WAV with cues failed:', error);
    res.status(500).json({
      success: false,
      error: { 
        message: 'Failed to export WAV with cue points',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
});

/**
 * Generate DAW markers from annotations with smart spacing and numbering
 */
function generateDAWMarkersFromAnnotations(annotations: any[]): DAWMarker[] {
  const parentAnnotations = annotations
    .filter(annotation => !annotation.parentId)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Group closely spaced annotations for better organization
  const groups = groupCloseAnnotations(parentAnnotations);
  let globalMarkerNumber = 1;
  
  const markers: DAWMarker[] = [];
  
  groups.forEach(group => {
    if (group.length === 1) {
      // Single annotation
      const annotation = group[0];
      const nextGroup = groups[groups.indexOf(group) + 1];
      const timeDifference = nextGroup ? nextGroup[0].timestamp - annotation.timestamp : Infinity;
      
      markers.push({
        timestamp: annotation.timestamp,
        label: formatMarkerLabel(annotation, globalMarkerNumber, timeDifference),
        type: getMarkerType(annotation.annotationType),
        color: getAnnotationColor(annotation),
        priority: annotation.priority,
        annotationType: annotation.annotationType,
        userId: annotation.userId,
        username: annotation.user?.username || 'Unknown',
        fullText: annotation.text.trim() // Preserve original full text
      });
      globalMarkerNumber++;
    } else {
      // Multiple annotations close together - create a group marker
      const firstAnnotation = group[0];
      const groupLabel = `#${globalMarkerNumber}-${globalMarkerNumber + group.length - 1} [${group.length} comments] ${formatTime(firstAnnotation.timestamp)}`;
      
      markers.push({
        timestamp: firstAnnotation.timestamp,
        label: groupLabel,
        type: 'marker' as const,
        color: '#71A9F7',
        priority: 'medium',
        annotationType: 'group',
        userId: firstAnnotation.userId,
        username: 'Multiple Users',
        fullText: `Group of ${group.length} annotations: ${group.map(a => a.text.substring(0, 50)).join(' | ')}`
      });
      
      // Add individual markers with compact labels
      group.forEach((annotation, index) => {
        markers.push({
          timestamp: annotation.timestamp + (index * 0.1), // Slight offset to prevent overlap
          label: `#${globalMarkerNumber + index} ${getAnnotationTypeIcon(annotation.annotationType)}: ${annotation.text.substring(0, 25)}...`,
          type: getMarkerType(annotation.annotationType),
          color: getAnnotationColor(annotation),
          priority: annotation.priority,
          annotationType: annotation.annotationType,
          userId: annotation.userId,
          username: annotation.user?.username || 'Unknown',
          fullText: annotation.text.trim() // Preserve original full text
        });
      });
      
      globalMarkerNumber += group.length;
    }
  });

  return markers;
}

/**
 * Group annotations that are within 3 seconds of each other
 */
function groupCloseAnnotations(annotations: any[]): any[][] {
  const groups: any[][] = [];
  let currentGroup: any[] = [];
  
  annotations.forEach((annotation, index) => {
    if (currentGroup.length === 0) {
      currentGroup.push(annotation);
    } else {
      const lastInGroup = currentGroup[currentGroup.length - 1];
      const timeDifference = annotation.timestamp - lastInGroup.timestamp;
      
      if (timeDifference <= 3) { // 3 seconds threshold for grouping
        currentGroup.push(annotation);
      } else {
        groups.push([...currentGroup]);
        currentGroup = [annotation];
      }
    }
  });
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Format timestamp for display
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format marker label for DAW display with smart spacing and numbering
 */
function formatMarkerLabel(annotation: any, markerNumber: number, timeDifference: number): string {
  const username = annotation.user?.username || 'Unknown';
  const typeIcon = getAnnotationTypeIcon(annotation.annotationType);
  const priorityIndicator = annotation.priority === 'critical' ? '[CRITICAL] ' : 
                           annotation.priority === 'high' ? '[HIGH] ' : 
                           annotation.priority === 'medium' ? '[MED] ' : '';
  
  // Smart text length based on spacing to next annotation
  const isCloseToNext = timeDifference < 5; // Less than 5 seconds
  const maxLength = isCloseToNext ? 35 : 60; // Shorter text for close annotations
  
  let text = annotation.text.trim();
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...';
  }
  
  // Create different formats based on spacing
  if (isCloseToNext) {
    // Compact format for closely spaced annotations
    return `#${markerNumber} ${typeIcon}: ${text}`;
  } else {
    // Full format for well-spaced annotations  
    return `#${markerNumber} ${priorityIndicator}${typeIcon} ${username}: ${text}`;
  }
}

/**
 * Get annotation type icon for DAW markers
 */
function getAnnotationTypeIcon(type: string): string {
  switch (type) {
    case 'issue': return 'ISSUE';
    case 'approval': return 'APPROVED';
    case 'marker': return 'MARKER';
    case 'section': return 'SECTION';
    case 'voice': return '🎤 VOICE NOTE';
    default: return 'COMMENT';
  }
}

/**
 * Get marker type for DAW compatibility
 */
function getMarkerType(annotationType: string): 'cue' | 'marker' | 'region' {
  switch (annotationType) {
    case 'section': return 'region';
    case 'marker': return 'cue';
    default: return 'marker';
  }
}

/**
 * Get annotation color
 */
function getAnnotationColor(annotation: any): string {
  // Priority-based colors first
  switch (annotation.priority) {
    case 'critical': return '#ef4444'; // Red
    case 'high': return '#f59e0b';     // Orange
    case 'medium': return '#eab308';   // Yellow
    case 'low': return '#22c55e';      // Green
  }
  
  // Type-based colors as fallback
  switch (annotation.annotationType) {
    case 'issue': return '#ef4444';
    case 'approval': return '#22c55e';
    case 'marker': return '#f59e0b';
    case 'voice': return '#8b5cf6';
    case 'section': return '#06b6d4';
    default: return '#71A9F7';
  }
}

/**
 * Embed cue points directly into existing WAV file data
 */
function embedCuePointsInWAV(wavData: Buffer, markers: DAWMarker[], sampleRate: number): Buffer {
  if (markers.length === 0) {
    return wavData; // No markers to embed
  }
  
  // Embed cue points into WAV file
  
  // Parse WAV file structure
  const dataView = new DataView(wavData.buffer.slice(wavData.byteOffset, wavData.byteOffset + wavData.byteLength));
  let offset = 12; // Skip RIFF header
  let dataChunkOffset = 0;
  let dataChunkSize = 0;
  
  // Find data chunk
  while (offset < wavData.length - 8) {
    const chunkId = dataView.getUint32(offset, false);
    const chunkSize = dataView.getUint32(offset + 4, true);
    
    if (chunkId === 0x64617461) { // "data"
      dataChunkOffset = offset;
      dataChunkSize = chunkSize;
      console.log(`🔍 Found data chunk at offset ${offset}, size: ${chunkSize}`);
      break;
    }
    
    offset += 8 + chunkSize;
    if (chunkSize % 2 === 1) offset++; // Align to even boundary
  }
  
  if (dataChunkOffset === 0) {
    throw new Error('Could not find data chunk in WAV file');
  }
  
  // Create cue chunk and associated data list chunk
  const cueChunk = createCueChunk(markers, sampleRate);
  const listChunk = createListChunk(markers, sampleRate);
  
  // Create new WAV file with both chunks inserted before data chunk
  const newSize = wavData.length + cueChunk.length + listChunk.length;
  const result = Buffer.alloc(newSize);
  
  // Copy everything before data chunk
  wavData.copy(result, 0, 0, dataChunkOffset);
  let writeOffset = dataChunkOffset;
  
  // Insert cue chunk
  cueChunk.copy(result, writeOffset);
  writeOffset += cueChunk.length;
  
  // Insert list chunk
  listChunk.copy(result, writeOffset);
  writeOffset += listChunk.length;
  
  // Copy data chunk and everything after
  wavData.copy(result, writeOffset, dataChunkOffset);
  
  // Update RIFF chunk size in header
  const newRiffSize = newSize - 8;
  result.writeUInt32LE(newRiffSize, 4);
  
  // WAV file updated with cue points
  return result;
}

/**
 * Create WAV cue chunk with marker data
 */
function createCueChunk(markers: DAWMarker[], sampleRate: number): Buffer {
  const numCues = markers.length;
  const cueChunkSize = 4 + (numCues * 24); // 4 bytes for count + 24 bytes per cue point
  const chunk = Buffer.alloc(8 + cueChunkSize);
  
  // Cue chunk header
  chunk.write('cue ', 0, 'ascii'); // Chunk ID
  chunk.writeUInt32LE(cueChunkSize, 4); // Chunk size
  chunk.writeUInt32LE(numCues, 8);      // Number of cue points
  
  // Sort markers by timestamp
  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  
  // Write cue points
  let offset = 12;
  sortedMarkers.forEach((marker, index) => {
    const samplePosition = Math.floor(marker.timestamp * sampleRate);
    
    chunk.writeUInt32LE(index + 1, offset + 0);      // Cue point ID (1-based)
    chunk.writeUInt32LE(samplePosition, offset + 4); // Play order position
    chunk.write('data', offset + 8, 'ascii');        // "data" chunk identifier
    chunk.writeUInt32LE(0, offset + 12);             // Chunk start (0 for uncompressed)
    chunk.writeUInt32LE(0, offset + 16);             // Block start (0 for uncompressed)
    chunk.writeUInt32LE(samplePosition, offset + 20); // Sample frame offset
    
    offset += 24;
  });
  
  // Cue chunk created
  return chunk;
}

/**
 * Create LIST chunk with associated data (marker names)
 */
function createListChunk(markers: DAWMarker[], sampleRate: number): Buffer {
  // Sort markers by timestamp
  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  
  // Calculate size needed for all label subchunks
  let labelsSize = 4; // "adtl" identifier
  const labelBuffers: Buffer[] = [];
  
  sortedMarkers.forEach((marker, index) => {
    const cleanLabel = createCleanMarkerText(marker);
    const labelBytes = Buffer.from(cleanLabel + '\0', 'utf8'); // Include null terminator
    const paddedSize = Math.ceil(labelBytes.length / 2) * 2; // Pad to even boundary
    
    const labelBuffer = Buffer.alloc(12 + paddedSize); // 12 bytes header + padded data
    labelBuffer.write('labl', 0, 'ascii'); // Label subchunk ID
    labelBuffer.writeUInt32LE(4 + paddedSize, 4); // Size: 4 (cue ID) + padded label
    labelBuffer.writeUInt32LE(index + 1, 8); // Cue point ID
    labelBytes.copy(labelBuffer, 12); // Copy label data
    
    labelBuffers.push(labelBuffer);
    labelsSize += labelBuffer.length;
  });
  
  // Create LIST chunk
  const chunk = Buffer.alloc(8 + labelsSize);
  
  // LIST chunk header
  chunk.write('LIST', 0, 'ascii'); // Chunk ID
  chunk.writeUInt32LE(labelsSize, 4);   // Chunk size
  chunk.write('adtl', 8, 'ascii');  // "adtl" (associated data list)
  
  let offset = 12;
  
  // Copy all label subchunks
  labelBuffers.forEach(labelBuffer => {
    labelBuffer.copy(chunk, offset);
    offset += labelBuffer.length;
  });
  
  // LIST chunk created
  return chunk;
}

/**
 * Create detailed marker text for WAV embedding (full text for zoom views)
 */
function createCleanMarkerText(marker: DAWMarker): string {
  const username = marker.username || 'Unknown';
  const typeText = getAnnotationTypeText(marker.annotationType || 'comment');
  const priorityText = marker.priority === 'critical' ? '[CRITICAL] ' : 
                      marker.priority === 'high' ? '[HIGH] ' : 
                      marker.priority === 'medium' ? '[MEDIUM] ' : 
                      marker.priority === 'low' ? '[LOW] ' : '';
  
  // Use the preserved full text if available, otherwise fall back to label
  const fullText = marker.fullText || marker.label
    .replace(/^#\d+(-\d+)?\s*/, '') // Remove marker numbers
    .replace(/^\[.*?\]\s*/, '') // Remove group indicators
    .replace(/^\w+:\s*/, '') // Remove type prefixes
    .replace(/\s*\.\.\.$/, '') // Remove truncation indicators
    .trim();
  
  // Format timestamp for reference
  const timeStr = formatTime(marker.timestamp);
  
  // Create comprehensive detailed label for zoom views that DAWs can display
  const detailedLabel = [
    `[${timeStr}]`, // Timestamp reference
    priorityText && `${priorityText.trim()}`, // Priority indicator
    `${typeText} by ${username}:`, // Type and author
    fullText // Complete original comment text (no truncation)
  ].filter(Boolean).join(' ');
  
  // Ensure the text is clean for WAV embedding but preserves readability
  return detailedLabel.replace(/[^\x20-\x7E]/g, ''); // Remove non-ASCII characters
}

/**
 * Get annotation type as readable text
 */
function getAnnotationTypeText(type: string): string {
  switch (type) {
    case 'issue': return 'ISSUE';
    case 'approval': return 'APPROVED';
    case 'marker': return 'MARKER';
    case 'section': return 'SECTION';
    case 'voice': return 'VOICE NOTE';
    default: return 'COMMENT';
  }
}

/**
 * Convert any audio format to WAV and embed cue points
 */
async function convertToWAVWithCuePoints(audioBuffer: Buffer, markers: DAWMarker[], sampleRate: number): Promise<Buffer> {
  const tempDir = os.tmpdir();
  const inputFile = path.join(tempDir, `input_${Date.now()}.tmp`);
  const outputFile = path.join(tempDir, `output_${Date.now()}.wav`);
  
  try {
    console.log('💾 Writing audio buffer to temporary file...');
    await writeFileAsync(inputFile, audioBuffer);
    
    // Convert audio to WAV using FFmpeg
    
    // Convert to WAV using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputFile)
        .toFormat('wav')
        .audioFrequency(sampleRate)
        .audioChannels(2) // Stereo
        .audioBitrate('16') // 16-bit depth
        .output(outputFile)
        .on('end', () => {
          // FFmpeg conversion completed
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg conversion failed:', err);
          reject(err);
        })
        .run();
    });
    
    console.log('📖 Reading converted WAV file...');
    const fs = require('fs');
    const wavBuffer = fs.readFileSync(outputFile);
    
    // Now embed cue points into the converted WAV
    // Embed cue points into converted WAV
    const finalBuffer = embedCuePointsInWAV(wavBuffer, markers, sampleRate);
    
    return finalBuffer;
    
  } finally {
    // Clean up temporary files
    try {
      await unlinkAsync(inputFile).catch(() => {});
      await unlinkAsync(outputFile).catch(() => {});
      console.log('🗑️ Cleaned up temporary files');
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up temporary files:', cleanupError);
    }
  }
}


/**
 * Create individual voice note tracks, each as a separate WAV file
 */
async function createIndividualVoiceNoteTracks(
  voiceNotes: any[], 
  mainAudioBuffer: Buffer, 
  sampleRate: number,
  projectTitle: string
): Promise<Array<{filename: string, buffer: Buffer}>> {
  const tempDir = os.tmpdir();
  const tracks: Array<{filename: string, buffer: Buffer}> = [];
  
  try {
    // Get main audio duration using FFmpeg
    
    // Save main audio to temp file to get accurate duration
    const mainAudioFile = path.join(tempDir, `main_audio_${Date.now()}.wav`);
    await writeFileAsync(mainAudioFile, mainAudioBuffer);
    
    // Get actual duration using FFmpeg probe
    const durationSeconds = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(mainAudioFile, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const duration = metadata.format.duration || 60; // fallback to 60 seconds
          resolve(Math.ceil(duration));
        }
      });
    });
    
    // Main audio duration determined
    
    for (let i = 0; i < voiceNotes.length; i++) {
      const voiceNote = voiceNotes[i];
      const voiceIndex = i + 1;
      
      try {
        // Creating voice track
        
        // Download voice note
        let downloadUrl: string;
        if (voiceNote.voiceNoteUrl.startsWith('http')) {
          downloadUrl = voiceNote.voiceNoteUrl;
        } else {
          downloadUrl = await s3UploadService.getSignedDownloadUrl(voiceNote.voiceNoteUrl, 3600);
        }
        
        const voiceBuffer = await downloadFileFromUrl(downloadUrl);
        
        // Create temporary files
        const voiceFile = path.join(tempDir, `voice_${voiceIndex}_${Date.now()}.tmp`);
        const outputFile = path.join(tempDir, `voice_track_${voiceIndex}_${Date.now()}.wav`);
        
        await writeFileAsync(voiceFile, voiceBuffer);
        
        // Create individual voice track using FFmpeg
        await new Promise<void>((resolve, reject) => {
          const timestamp = voiceNote.timestamp;
          const delayMs = Math.floor(timestamp * 1000);
          
          ffmpeg()
            // Create silent base track of full duration
            .input(`anullsrc=duration=${durationSeconds}:sample_rate=${sampleRate}:channel_layout=stereo`)
            .inputFormat('lavfi')
            // Add voice note file
            .input(voiceFile)
            // Mix voice note at specific timestamp
            .complexFilter([
              `[1:a]adelay=${delayMs}|${delayMs}[delayed_voice]`,
              `[0:a][delayed_voice]amix=inputs=2:duration=longest[out]`
            ], 'out')
            .audioFrequency(sampleRate)
            .audioChannels(2)
            .toFormat('wav')
            .output(outputFile)
            .on('end', () => {
              // Voice track completed
              resolve();
            })
            .on('error', (err) => {
              console.error(`❌ Voice track ${voiceIndex} failed:`, err);
              reject(err);
            })
            .run();
        });
        
        // Read the generated track
        const trackBuffer = require('fs').readFileSync(outputFile);
        
        // Generate clean filename
        const username = voiceNote.user?.username || 'User';
        const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '');
        const timeStr = formatTime(voiceNote.timestamp);
        const filename = `${projectTitle}_VoiceNote_${voiceIndex}_${cleanUsername}_${timeStr.replace(':', 'm')}s.wav`;
        
        tracks.push({
          filename,
          buffer: trackBuffer
        });
        
        // Voice track file created
        
        // Clean up temp files
        await unlinkAsync(voiceFile).catch(() => {});
        await unlinkAsync(outputFile).catch(() => {});
        
      } catch (voiceError) {
        console.warn(`⚠️ Failed to create voice track ${voiceIndex}:`, voiceError);
      }
    }
    
    // Clean up main audio temp file
    await unlinkAsync(mainAudioFile).catch(() => {});
    
    // Voice note tracks creation completed
    return tracks;
    
  } catch (error) {
    console.error('❌ Voice tracks creation failed:', error);
    throw error;
  }
}

/**
 * Download file from URL using https/http
 */
async function downloadFileFromUrl(url: string): Promise<Buffer> {
  const https = require('https');
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (response: any) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Create a simple archive with all voice note files
 */
async function createVoiceNotesArchive(
  mainAudio: Buffer, 
  voiceNoteTracks: Array<{filename: string, buffer: Buffer}>, 
  projectTitle: string
): Promise<Buffer> {
  // Creating archive with main audio + voice tracks
  
  // Create file list
  const files = [
    { name: `${projectTitle}.wav`, content: mainAudio },
    ...voiceNoteTracks.map(track => ({ name: track.filename, content: track.buffer })),
    { 
      name: 'IMPORT_INSTRUCTIONS.txt', 
      content: Buffer.from(generateVoiceNotesInstructions(projectTitle, voiceNoteTracks.length), 'utf8') 
    }
  ];
  
  // Create simple TAR-like archive
  let totalSize = 0;
  const fileBuffers: Buffer[] = [];
  const fileHeaders: Buffer[] = [];
  
  for (const file of files) {
    const header = Buffer.alloc(512);
    
    // Write filename (first 100 bytes)
    Buffer.from(file.name).copy(header, 0, 0, Math.min(file.name.length, 100));
    
    // Write file size in octal (bytes 124-135)
    const sizeOctal = file.content.length.toString(8).padStart(11, '0') + ' ';
    Buffer.from(sizeOctal).copy(header, 124, 0, 12);
    
    fileHeaders.push(header);
    fileBuffers.push(file.content);
    totalSize += header.length + file.content.length;
  }
  
  // Combine all parts
  const result = Buffer.alloc(totalSize);
  let offset = 0;
  
  for (let i = 0; i < files.length; i++) {
    fileHeaders[i].copy(result, offset);
    offset += fileHeaders[i].length;
    fileBuffers[i].copy(result, offset);
    offset += fileBuffers[i].length;
  }
  
  // Archive created successfully
  return result;
}

/**
 * Generate instructions for importing voice note tracks
 */
function generateVoiceNotesInstructions(projectTitle: string, voiceCount: number): string {
  return `VOICE NOTES PACKAGE - ${projectTitle}
${'='.repeat(50)}

This package contains:
• ${projectTitle}.wav - Main audio with embedded cue points
• ${voiceCount} individual voice note tracks

VOICE NOTE TRACKS:
Each voice note is on its own separate track:
• Same length as main audio
• Voice note positioned at exact timestamp  
• Silent audio before/after the voice note
• Perfect alignment with main timeline

IMPORT INSTRUCTIONS:
1. Extract this archive
2. Open your DAW (Pro Tools, Logic, Reaper, etc.)
3. Create a new session/project
4. Import ${projectTitle}.wav to Track 1 (main audio)
5. Import each voice note WAV to separate tracks (Track 2, 3, 4...)
6. All tracks are perfectly aligned
7. Cue points show annotation locations

BENEFITS:
• Individual control over each voice note
• Can adjust volume/EQ per voice note
• No overlapping voice notes
• Perfect for long voice feedback
• Professional A&R workflow

PRO TIP:
• Group voice note tracks for easy management
• Set voice tracks to lower volume for monitoring
• Use different colors for each voice note track

Generated by Skribble Music Collaboration Platform`;
}

export default router;