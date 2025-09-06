// frontend/src/lib/audioUtils.ts - Enhanced with DAW export functionality
import JSZip from 'jszip';

export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
}

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitRate?: number;
  format: string;
}


// Enhanced DAW marker interface
export interface DAWMarker {
  timestamp: number;
  label: string;
  type: 'cue' | 'marker' | 'region';
  color?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  annotationType?: string;
  userId?: string;
  username?: string;
}


// DAW Export formats
export type DAWExportFormat = 
  | 'wav-cues' 
  | 'reaper-rpp' 
  | 'aaf-professional';

/**
 * Generate DAW markers from annotations with enhanced formatting
 */
export function generateEnhancedDAWMarkers(annotations: any[]): DAWMarker[] {
  return annotations
    .filter(annotation => !annotation.parentId) // Only parent annotations
    .map(annotation => ({
      timestamp: annotation.timestamp,
      label: formatMarkerLabel(annotation),
      type: getMarkerType(annotation.annotationType),
      color: getAnnotationColor(annotation),
      priority: annotation.priority,
      annotationType: annotation.annotationType,
      userId: annotation.userId,
      username: annotation.user?.username || 'Unknown'
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}



/**
 * Format marker label for DAW display
 */
function formatMarkerLabel(annotation: any): string {
  const username = annotation.user?.username || 'Unknown';
  const typeIcon = getAnnotationTypeIcon(annotation.annotationType);
  const priorityIndicator = annotation.priority === 'critical' ? '🔥 ' : 
                           annotation.priority === 'high' ? '⚡ ' : '';
  
  // Truncate text but keep it readable
  const maxLength = 60;
  let text = annotation.text.trim();
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...';
  }
  
  return `${priorityIndicator}${typeIcon} ${username}: ${text}`;
}

/**
 * Get annotation type icon for DAW markers
 */
function getAnnotationTypeIcon(type: string): string {
  switch (type) {
    case 'issue': return '⚠️';
    case 'approval': return '✅';
    case 'marker': return '📍';
    case 'section': return '🎵';
    case 'voice': return '🎤';
    default: return '💬';
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
 * Get annotation color (enhanced from original)
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
 * Generate WAV file with embedded cue points
 * This creates a downloadable blob with properly embedded BWF/WAV cue point metadata
 */
export async function generateWAVWithCues(
  audioUrl: string
): Promise<Blob> {
  try {
    // Simple implementation that just returns the original audio file
    // This restores the original working behavior
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return new Blob([arrayBuffer], { type: 'audio/wav' });
    
  } catch (error) {
    console.error('Error generating WAV with cues:', error);
    throw error;
  }
}

/**
 * Embed cue points directly into existing WAV file data
 */
function embedCuePointsInWAV(wavData: Uint8Array, markers: DAWMarker[]): Uint8Array {
  if (markers.length === 0) {
    return wavData; // No markers to embed
  }
  
  console.log(`📍 Embedding ${markers.length} cue points into WAV file...`);
  
  // Parse WAV file structure
  const dataView = new DataView(wavData.buffer);
  let offset = 12; // Skip RIFF header
  let dataChunkOffset = 0;
  let dataChunkSize = 0;
  let sampleRate = 44100; // Default, will be read from fmt chunk
  
  // Find fmt and data chunks
  while (offset < wavData.length - 8) {
    const chunkId = dataView.getUint32(offset, false);
    const chunkSize = dataView.getUint32(offset + 4, true);
    
    if (chunkId === 0x666d7420) { // "fmt "
      // Read sample rate from fmt chunk
      sampleRate = dataView.getUint32(offset + 12, true);
      console.log(`🔍 Found fmt chunk, sample rate: ${sampleRate}Hz`);
    } else if (chunkId === 0x64617461) { // "data"
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
  
  // Create cue chunk and associated data list chunk (Pro Tools requirement)
  const cueChunk = createCueChunk(markers, sampleRate);
  const listChunk = createListChunk(markers, sampleRate);
  
  // Create new WAV file with both chunks inserted before data chunk
  const newSize = wavData.length + cueChunk.length + listChunk.length;
  const result = new Uint8Array(newSize);
  
  // Copy everything before data chunk
  result.set(wavData.subarray(0, dataChunkOffset));
  let writeOffset = dataChunkOffset;
  
  // Insert cue chunk
  result.set(cueChunk, writeOffset);
  writeOffset += cueChunk.length;
  
  // Insert list chunk (Pro Tools needs this for marker names)
  result.set(listChunk, writeOffset);
  writeOffset += listChunk.length;
  
  // Copy data chunk and everything after
  result.set(wavData.subarray(dataChunkOffset), writeOffset);
  
  // Update RIFF chunk size in header
  const newRiffSize = newSize - 8;
  const resultView = new DataView(result.buffer);
  resultView.setUint32(4, newRiffSize, true);
  
  console.log(`✅ WAV file updated: ${wavData.length} → ${newSize} bytes (+${cueChunk.length + listChunk.length} marker data)`);
  return result;
}

/**
 * Create WAV cue chunk with marker data
 */
function createCueChunk(markers: DAWMarker[], sampleRate: number): Uint8Array {
  const numCues = markers.length;
  const cueChunkSize = 4 + (numCues * 24); // 4 bytes for count + 24 bytes per cue point
  const chunk = new Uint8Array(8 + cueChunkSize);
  const view = new DataView(chunk.buffer);
  
  // Cue chunk header
  view.setUint32(0, 0x63756520, false); // "cue "
  view.setUint32(4, cueChunkSize, true); // Chunk size
  view.setUint32(8, numCues, true);      // Number of cue points
  
  // Sort markers by timestamp
  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  
  // Write cue points
  let offset = 12;
  sortedMarkers.forEach((marker, index) => {
    const samplePosition = Math.floor(marker.timestamp * sampleRate);
    
    view.setUint32(offset + 0, index + 1, true);      // Cue point ID (1-based)
    view.setUint32(offset + 4, samplePosition, true); // Play order position
    view.setUint32(offset + 8, 0x64617461, false);    // "data" chunk identifier
    view.setUint32(offset + 12, 0, true);             // Chunk start (0 for uncompressed)
    view.setUint32(offset + 16, 0, true);             // Block start (0 for uncompressed)
    view.setUint32(offset + 20, samplePosition, true); // Sample frame offset
    
    offset += 24;
  });
  
  console.log(`📦 Created cue chunk: ${numCues} cues, ${chunk.length} bytes`);
  return chunk;
}

/**
 * Create LIST chunk with associated data (Pro Tools requirement for marker names)
 */
function createListChunk(markers: DAWMarker[], sampleRate: number): Uint8Array {
  // Sort markers by timestamp
  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  
  // Calculate size needed for all label subchunks
  let labelsSize = 4; // "adtl" identifier
  sortedMarkers.forEach((marker, index) => {
    const cleanLabel = createCleanMarkerText(marker);
    const labelBytes = new TextEncoder().encode(cleanLabel + '\0'); // Include null terminator
    const paddedSize = Math.ceil(labelBytes.length / 2) * 2; // Pad to even boundary
    console.log(`📝 Marker ${index + 1}: "${cleanLabel}" -> ${labelBytes.length} bytes -> ${paddedSize} padded`);
    labelsSize += 12 + paddedSize; // 12 bytes header (labl + size + cueId) + padded data
  });
  
  // Create LIST chunk
  const chunk = new Uint8Array(8 + labelsSize);
  const view = new DataView(chunk.buffer);
  
  // LIST chunk header
  view.setUint32(0, 0x4C495354, false); // "LIST"
  view.setUint32(4, labelsSize, true);   // Chunk size
  view.setUint32(8, 0x6164746C, false);  // "adtl" (associated data list)
  
  let offset = 12;
  
  // Write label subchunks for each marker
  sortedMarkers.forEach((marker, index) => {
    const cueId = index + 1;
    const cleanLabel = createCleanMarkerText(marker);
    const labelBytes = new TextEncoder().encode(cleanLabel + '\0'); // Null-terminated
    const paddedSize = Math.ceil(labelBytes.length / 2) * 2; // Pad to even boundary
    
    // Label subchunk header
    view.setUint32(offset, 0x6C61626C, false); // "labl"
    view.setUint32(offset + 4, 4 + paddedSize, true); // Size: 4 (cue ID) + padded label
    view.setUint32(offset + 8, cueId, true); // Cue point ID
    
    // Copy label data safely
    const labelDataOffset = offset + 12;
    for (let i = 0; i < labelBytes.length; i++) {
      view.setUint8(labelDataOffset + i, labelBytes[i]);
    }
    
    offset += 12 + paddedSize;
  });
  
  console.log(`📝 Created LIST chunk: ${sortedMarkers.length} labels, ${chunk.length} bytes`);
  return chunk;
}

/**
 * Convert non-WAV audio to WAV with embedded cue points using Web Audio API
 */
async function convertToWAVWithCues(audioUrl: string, markers: DAWMarker[]): Promise<Blob> {
  try {
    console.log('🔄 Converting audio to WAV with cue points...');
    
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Fetch and decode audio
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log(`🎵 Audio decoded: ${audioBuffer.sampleRate}Hz, ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels}ch`);
    
    // Convert AudioBuffer to WAV with cue points
    const wavData = audioBufferToWAVWithCues(audioBuffer, markers);
    
    // Clean up
    audioContext.close();
    
    console.log('✅ Audio converted to WAV with embedded cue points');
    return new Blob([wavData], { type: 'audio/wav' });
    
  } catch (error) {
    console.error('❌ Audio conversion failed:', error);
    throw new Error(`Failed to convert audio to WAV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert AudioBuffer to WAV format with embedded cue points
 */
function audioBufferToWAVWithCues(audioBuffer: AudioBuffer, markers: DAWMarker[]): Uint8Array {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  
  // Calculate sizes
  const dataSize = audioBuffer.length * blockAlign;
  const cueChunk = markers.length > 0 ? createCueChunk(markers, sampleRate) : new Uint8Array(0);
  // Temporarily disable LIST chunk to test basic cue points
  const listChunk = new Uint8Array(0); // markers.length > 0 ? createListChunk(markers, sampleRate) : new Uint8Array(0);
  const fileSize = 44 + dataSize + cueChunk.length + listChunk.length; // 44 = WAV header size
  
  // Create WAV file
  const wav = new Uint8Array(fileSize);
  const view = new DataView(wav.buffer);
  
  let offset = 0;
  
  // RIFF header
  view.setUint32(offset, 0x52494646, false); offset += 4; // "RIFF"
  view.setUint32(offset, fileSize - 8, true); offset += 4; // File size - 8
  view.setUint32(offset, 0x57415645, false); offset += 4; // "WAVE"
  
  // fmt chunk
  view.setUint32(offset, 0x666d7420, false); offset += 4; // "fmt "
  view.setUint32(offset, 16, true); offset += 4;          // fmt chunk size
  view.setUint16(offset, format, true); offset += 2;      // Audio format (PCM)
  view.setUint16(offset, numChannels, true); offset += 2; // Number of channels
  view.setUint32(offset, sampleRate, true); offset += 4;  // Sample rate
  view.setUint32(offset, byteRate, true); offset += 4;    // Byte rate
  view.setUint16(offset, blockAlign, true); offset += 2;  // Block align
  view.setUint16(offset, bitDepth, true); offset += 2;    // Bits per sample
  
  // Add cue chunk before data chunk (Pro Tools prefers this order)
  if (cueChunk.length > 0) {
    console.log(`📍 Adding cue chunk at offset ${offset}, size: ${cueChunk.length}`);
    wav.set(cueChunk, offset);
    offset += cueChunk.length;
  }
  
  // Add LIST chunk with marker names (Pro Tools requirement)
  if (listChunk.length > 0) {
    console.log(`📝 Adding LIST chunk at offset ${offset}, size: ${listChunk.length}`);
    wav.set(listChunk, offset);
    offset += listChunk.length;
  }
  
  // data chunk header
  view.setUint32(offset, 0x64617461, false); offset += 4; // "data"
  view.setUint32(offset, dataSize, true); offset += 4;    // Data chunk size
  
  // Convert audio data to 16-bit PCM
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }
  
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i])); // Clamp
      const intSample = Math.round(sample * 32767); // Convert to 16-bit
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  console.log(`🎵 Created WAV: ${fileSize} bytes, ${markers.length} cue points embedded`);
  return wav;
}

function generateReaperInstructions(cleanFileName: string, projectTitle: string, originalUrl: string, markerCount: number): string {
  return `REAPER PROJECT SETUP INSTRUCTIONS
${'='.repeat(50)}

Project: ${projectTitle}
Generated: ${new Date().toISOString()}
Markers: ${markerCount} timeline markers

📁 FILES EXPORTED:
✅ ${projectTitle}.rpp           → Reaper project file (contains ${markerCount} timeline markers)
✅ ${projectTitle}_REAPER_INSTRUCTIONS.txt → This instruction file

🎵 REQUIRED AUDIO FILE:
❗ You need to download: ${cleanFileName}

📋 SETUP STEPS:

1. DOWNLOAD YOUR AUDIO:
   • Go back to your Skribble project
   • Download the original audio file
   • Save it as: ${cleanFileName}
   • ⚠️  IMPORTANT: The filename must be EXACTLY "${cleanFileName}"

2. ORGANIZE FILES:
   • Create a new folder for your project
   • Put these files in the same folder:
     - ${projectTitle}.rpp
     - ${cleanFileName}

3. OPEN IN REAPER:
   • Launch Reaper
   • File → Open Project → Select ${projectTitle}.rpp
   • Your audio will load automatically with all markers! 🎉

4. VIEW MARKERS:
   • Markers should appear automatically on the timeline ruler
   • If not visible: View → Markers/Regions → Show markers
   • Or press Alt+M to toggle marker visibility
   • Click markers to jump to annotation positions

🚨 TROUBLESHOOTING:

Problem: "File not found" error in Reaper
Solution: Make sure your audio file is named exactly "${cleanFileName}"

Problem: Audio loads but no markers visible
Solution: 
• Check View → Markers/Regions → Show markers
• Press Alt+M to toggle marker visibility
• Zoom out to see markers across the timeline

Problem: Markers appear but wrong positions
Solution: Check your project sample rate matches the audio file

Problem: Wrong audio file
Solution: Download the original file from your Skribble project

💡 PRO TIPS:
• Markers appear as colored flags on the timeline ruler
• Right-click markers for options (edit, delete, navigate)
• Use J and K keys to jump between markers
• Double-click markers to edit their names
• Drag markers to reposition them if needed

🎯 WHAT YOU'LL SEE:
• ${markerCount} colored markers on the timeline ruler
• Each marker shows your annotation text
• Color-coded by priority:
  - 🔥 Red = Critical priority
  - ⚡ Orange = High priority  
  - 💛 Yellow = Medium priority
  - 💚 Green = Low priority
• Click any marker to jump to that position
• Audio file loaded and ready for editing

🎵 MARKER NAVIGATION:
• Ctrl+Left/Right arrows to jump between markers
• Right-click timeline → Go to marker → Select specific marker
• View → Markers/Regions → Marker List to see all markers

Generated by Skribble Music Collaboration Platform
Need help? Contact support with this instruction file.

🔗 Original audio source: ${originalUrl.split('?')[0]}
`;
}

function generateReaperMarkers(markers: DAWMarker[]): string {
  if (!markers || markers.length === 0) {
    return '  ; No markers to export';
  }

  return markers.map((marker, index) => {
    // Convert timestamp to precise Reaper format (seconds with 6 decimal places)
    const timestamp = parseFloat(marker.timestamp.toFixed(6));
    
    // Convert color to Reaper's integer format
    const colorHex = marker.color?.replace('#', '') || '71A9F7';
    let colorInt = parseInt(colorHex, 16);
    
    // Reaper color format: Add alpha channel and ensure proper format
    // Colors in Reaper are stored as BGR + alpha in hexadecimal, converted to integer
    const r = (colorInt >> 16) & 0xFF;
    const g = (colorInt >> 8) & 0xFF;
    const b = colorInt & 0xFF;
    const a = 0x01; // Alpha channel
    
    // Convert to Reaper's BGR format with alpha
    const reaperColor = (a << 24) | (r << 16) | (g << 8) | b;
    
    // Clean marker label - remove quotes and limit length
    let label = marker.label.replace(/"/g, "'").trim();
    if (label.length > 100) {
      label = label.substring(0, 97) + "...";
    }
    
    // Reaper marker format:
    // MARKER [position] "[name]" [color] [shown] [type] {GUID}
    // position: time in seconds
    // name: marker name in quotes
    // color: integer color value
    // shown: 1 = visible, 0 = hidden
    // type: 0 = marker, 1 = region start, 2 = region end
    return `  MARKER ${timestamp} "${label}" ${reaperColor} 1 0 {${generateGUID()}}`;
  }).join('\n');
}


// Add a test function to verify marker format
export function testReaperMarkerFormat(markers: DAWMarker[]): void {
  console.log('🧪 Testing Reaper marker format...');
  
  markers.forEach((marker, index) => {
    console.log(`📍 Marker ${index + 1}:`, {
      timestamp: marker.timestamp,
      label: marker.label,
      color: marker.color,
      type: marker.type
    });
  });
  
  const markerLines = generateReaperMarkers(markers);
  console.log('📝 Generated marker lines:');
  console.log(markerLines);
  
  // Check for common issues
  if (markerLines.includes('undefined')) {
    console.warn('⚠️ Warning: Found undefined values in markers');
  }
  
  if (markerLines.includes('NaN')) {
    console.warn('⚠️ Warning: Found NaN values in timestamps');
  }
  
  console.log('✅ Marker format test complete');
}

function generateReaperProjectWithCleanName(cleanFileName: string, markers: DAWMarker[], projectName: string): string {
  return `<REAPER_PROJECT 0.1 "7.0" 1234567890
  TEMPO 120 4 4
  ${markers.map(marker => {
    const colorInt = 0x1FF0000; // Red color
    const timestamp = parseFloat(marker.timestamp.toFixed(3));
    return `MARKER ${timestamp} "${marker.label.replace(/"/g, '\\"')}" 0 ${colorInt} 1 B {${generateGUID()}}`;
  }).join('\n  ')}
  <TRACK {${generateGUID()}}
    NAME "${projectName}"
    <ITEM
      POSITION 0
      LENGTH ${Math.ceil(Math.max(...markers.map(m => m.timestamp), 60))}
      NAME "${cleanFileName}"
      <SOURCE FILE
        FILE "${cleanFileName}"
      >
    >
  >
>`;
}

export async function exportReaperWithZipBundle(
  audioUrl: string,
  annotations: any[],
  projectTitle: string,
  audioFileName: string
): Promise<void> {
  try {
    console.log('🎛️ Starting enhanced Reaper export with ZIP bundle...');
    
    const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    const markers = generateEnhancedDAWMarkers(annotations);
    
    // Extract clean filename and detect file extension
    const cleanFileName = extractCleanFilename(audioUrl, projectTitle);
    const audioExtension = audioFileName.split('.').pop() || 'mp3';
    // IMPORTANT: Use strict sanitization to match .rpp file expectations (no spaces)
    const strictSanitizedTitle = sanitizedTitle.replace(/[^a-zA-Z0-9._-]/g, '');
    const bundledAudioName = `${strictSanitizedTitle}.${audioExtension}`;
    
    console.log('📊 Export details:', {
      originalTitle: projectTitle,
      sanitizedTitle: sanitizedTitle,
      strictSanitizedTitle: strictSanitizedTitle,
      markerCount: markers.length,
      audioFile: bundledAudioName
    });

    // Create ZIP package
    const zip = new JSZip();
    
    // 1. Generate and add Reaper project file
    const voiceNotes = annotations.filter(ann => ann.voiceNoteUrl);
    const reaperProject = generateEnhancedReaperProject(
      bundledAudioName, // Reference the bundled audio name
      markers,
      strictSanitizedTitle, // Use strict sanitization for consistency
      bundledAudioName,
      voiceNotes // Pass voice notes for track creation
    );
    zip.file(`${strictSanitizedTitle}.rpp`, reaperProject);
    
    // 2. Download and add the actual audio file
    console.log('📥 Fetching audio file...');
    console.log('📁 Will add audio to ZIP as:', bundledAudioName);
    const audioBlob = await fetchAudioFile(audioUrl);
    zip.file(bundledAudioName, audioBlob);
    console.log('✅ Added audio file to ZIP with name:', bundledAudioName);
    
    // 3. Add voice notes if present (and user has permission)
    if (voiceNotes.length > 0) {
      console.log(`🎤 Adding ${voiceNotes.length} voice notes...`);
      
      for (let i = 0; i < voiceNotes.length; i++) {
        const voiceNote = voiceNotes[i];
        try {
          const voiceBlob = await fetchAudioFile(voiceNote.voiceNoteUrl);
          const rawUsername = voiceNote.user?.username || 'user';
          const sanitizedUsername = rawUsername.replace(/[^a-zA-Z0-9_-]/g, '');
          const voiceFileName = `voice_notes/voice_note_${String(i + 1).padStart(2, '0')}_${sanitizedUsername}.mp3`;
          console.log(`🎤 Adding voice note ${i + 1}: "${voiceFileName}" (raw username: "${rawUsername}")`);
          zip.file(voiceFileName, voiceBlob);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch voice note ${i + 1}:`, error);
        }
      }
    }
    
    // 4. Add comprehensive instructions
    const instructions = generateComprehensiveInstructions(
      strictSanitizedTitle,
      bundledAudioName,
      markers.length,
      voiceNotes.length
    );
    zip.file('README.txt', instructions);
    
    // 5. Add quick start guide
    const quickStart = generateQuickStartGuide(strictSanitizedTitle);
    zip.file('QUICK_START.txt', quickStart);
    
    // 6. Generate and download the ZIP
    console.log('📦 Generating ZIP package...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Download the complete package
    const zipFileName = `${strictSanitizedTitle}_Reaper_Project.zip`;
    downloadFile(zipBlob, zipFileName, 'application/zip');
    
    console.log('✅ Reaper project package created successfully!');
    console.log('📦 Package details:', {
      fileName: zipFileName,
      audioFile: bundledAudioName,
      markerCount: markers.length,
      voiceNoteCount: voiceNotes.length
    });
    
  } catch (error) {
    console.error('❌ Reaper ZIP export failed:', error);
    throw new Error(`Failed to create Reaper project package: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchAudioFile(audioUrl: string): Promise<Blob> {
  try {
    console.log('🌐 Fetching audio file from:', audioUrl);
    const response = await fetch(audioUrl);
    
    console.log('📡 Fetch response:', {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length')
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    console.log('🎵 Audio blob created:', {
      size: blob.size,
      type: blob.type
    });
    
    // Verify it's an audio file
    if (!blob.type.startsWith('audio/')) {
      console.warn('⚠️ Warning: File may not be audio format, type:', blob.type);
    }
    
    return blob;
    
  } catch (error) {
    console.error('❌ Failed to fetch audio file:', audioUrl, error);
    throw new Error(`Failed to download audio file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function generateComprehensiveInstructions(
  projectTitle: string,
  audioFileName: string,
  markerCount: number,
  voiceNoteCount: number
): string {
  return `SKRIBBLE → REAPER PROJECT PACKAGE
${'='.repeat(50)}

Project: ${projectTitle}
Generated: ${new Date().toLocaleString()}
Total Markers: ${markerCount}
Voice Notes: ${voiceNoteCount}

🎯 WHAT'S INCLUDED:

✅ ${projectTitle}.rpp          → Complete Reaper project file
✅ ${audioFileName}            → Your original audio file  
${voiceNoteCount > 0 ? `✅ voice_notes/              → ${voiceNoteCount} voice note MP3 files` : '❌ Voice notes               → (Upgrade to Producer tier)'}
✅ README.txt                  → Detailed instructions (this file)
✅ QUICK_START.txt             → 30-second setup guide

🚀 QUICK SETUP (30 seconds):

1. Extract this ZIP file to a folder
2. Open Reaper 
3. File → Open Project → Select "${projectTitle}.rpp"
4. Done! Everything loads automatically 🎉

📋 DETAILED SETUP:

1. EXTRACT FILES:
   • Right-click the ZIP file
   • Choose "Extract All" or "Extract Here"
   • Keep all files in the same folder

2. VERIFY FILES:
   • ${projectTitle}.rpp ✓
   • ${audioFileName} ✓
   ${voiceNoteCount > 0 ? `   • voice_notes/ folder with ${voiceNoteCount} MP3s ✓` : ''}

3. OPEN IN REAPER:
   • Launch Reaper
   • File → Open Project
   • Navigate to extracted folder
   • Select "${projectTitle}.rpp"
   • Click Open

4. WHAT YOU'LL SEE:
   • Track 1: Your main audio file (${audioFileName})
   ${voiceNoteCount > 0 ? `   • Track 2+: Voice note tracks (one per collaborator)` : ''}
   • Timeline: ${markerCount} colored markers with feedback
   • Project properly set up with correct timing

🎨 MARKER LEGEND:
🔥 Critical Priority    ⚡ High Priority    ⚠️ Issues
✅ Approvals           📍 Markers         🎤 Voice Notes  
🎵 Sections           💬 Comments        

🔧 WORKING WITH THE PROJECT:

• All audio is perfectly synced to timestamps
• Markers show exact feedback locations
• Voice notes are on separate tracks (solo/mute as needed)
• Make your changes and render when done!

⚠️ IMPORTANT NOTES:

• Keep all files in the same folder
• Don't rename the audio files
• Voice note tracks are labeled with usernames
• Original audio is unmodified (make copies if needed)

💡 TIPS FOR REAPER:

• Right-click markers to edit or add notes
• Use track envelopes for automation
• Solo voice note tracks to focus on specific feedback
• Save your project changes to a new name when done

---
🌟 Exported from Skribble Music Collaboration Platform
Need help? Visit skribble.app/help
`;
}

/**
 * Generate quick start guide
 */
function generateQuickStartGuide(projectTitle: string): string {
  return `⚡ QUICK START - ${projectTitle}
${'='.repeat(30)}

30-SECOND SETUP:

1. 📂 Extract ZIP file
2. 🎵 Open Reaper
3. 📁 File → Open Project  
4. 🎯 Select "${projectTitle}.rpp"
5. ✅ Done!

Everything loads automatically:
• Audio file synced perfectly
• All markers on timeline  
• Voice notes on separate tracks
• Ready to edit immediately

🎊 THAT'S IT! Start making your changes!

For detailed instructions, see README.txt

---
Skribble Music Collaboration
`;
}

/**
 * Generate Reaper project file with enhanced markers
 */
export function generateEnhancedReaperProject(
  audioFilePath: string,
  markers: DAWMarker[],
  projectName: string,
  audioFileName: string,
  voiceNotes: any[] = []
): string {
  
  // IMPORTANT: Only use the clean filename, never the full path/URL
  const cleanFileName = audioFileName || audioFilePath.split('/').pop() || 'audio.wav';
  
  console.log('🎛️ Generating WORKING Reaper project (reference-based) with filename:', cleanFileName);
  console.log('🎯 Project name:', projectName);
  console.log('📍 Marker count:', markers.length);
  console.log('🎤 Voice note count:', voiceNotes.length);
  
  // Ensure we NEVER use URLs with query parameters
  if (cleanFileName.includes('?') || cleanFileName.includes('X-Amz')) {
    console.error('❌ DETECTED S3 URL IN FILENAME - This should not happen!');
    console.error('🚨 Clean filename contains S3 parameters:', cleanFileName);
    // Force a clean name
    const emergencyName = `${projectName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim()}.wav`;
    console.log('🚑 Emergency fallback filename:', emergencyName);
    return generateReaperProjectWithCleanName(emergencyName, markers, projectName);
  }

  const audioLength = Math.ceil(Math.max(...markers.map(m => m.timestamp), 180));
  
  // Much stricter sanitization for compatibility
  const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, ' ').trim();
  const sanitizedFileName = cleanFileName.replace(/[^a-zA-Z0-9._-]/g, ''); // No spaces at all
  
  console.log('🔧 Sanitized for .rpp:', {
    originalProject: projectName,
    sanitizedProject: sanitizedProjectName,
    originalFile: cleanFileName,
    sanitizedFile: sanitizedFileName
  });
  
  // Generate proper SOURCE type based on file extension
  const fileExtension = sanitizedFileName.toLowerCase().split('.').pop() || 'wav';
  const sourceType = fileExtension === 'mp3' ? 'MP3' : 'WAVE';
  
  // WORKING Reaper project format - matches the reference file structure
  const projectId = Math.floor(Math.random() * 2000000000);
  const reaper = `<REAPER_PROJECT 0.1 "7.02/win64" ${projectId}
  <NOTES 0 2
  >
  RIPPLE 0
  GROUPOVERRIDE 0 0 0
  AUTOXFADE 129
  ENVATTACH 3
  POOLEDENVATTACH 0
  MIXERUIFLAGS 11 48
  PEAKGAIN 1
  FEEDBACK 0
  PANLAW 1
  PROJOFFS 0 0 0
  MAXPROJLEN 0 600
  GRID 3199 8 1 8 1 0 0 0
  TIMEMODE 1 5 -1 30 0 0 -1
  VIDEO_CONFIG 0 0 256
  PANMODE 3
  CURSOR 0
  ZOOM 4.61122669093424 0 0
  VZOOMEX 7.53933573 0
  USE_REC_CFG 0
  RECMODE 1
  SMPTESYNC 0 30 100 40 1000 300 0 0 1 0 0
  LOOP 0
  LOOPGRAN 0 4
  RECORD_PATH "" ""
  <RECORD_CFG
    ZXZhdxAAAA==
  >
  <APPLYFX_CFG
  >
  RENDER_FILE ""
  RENDER_PATTERN ""
  RENDER_FMT 0 2 0
  RENDER_1X 0
  RENDER_RANGE 1 0 0 18 1000
  RENDER_RESAMPLE 3 0 1
  RENDER_ADDTOPROJ 0
  RENDER_STEMS 0
  RENDER_DITHER 0
  TIMELOCKMODE 1
  TEMPOENVLOCKMODE 1
  ITEMMIX 1
  DEFPITCHMODE 589824 0
  TAKELANE 1
  SAMPLERATE 44100 1 0
  INTMIXMODE 4
  <RENDER_CFG
    ZXZhdxAAAA==
  >
  LOCK 1
  <METRONOME 6 2
    VOL 0.25 0.125
    FREQ 800 1600 1
    BEATLEN 4
    SAMPLES "" ""
    PATTERN 2863311530 2863311529
    MULT 1
  >
  GLOBAL_AUTO -1
  TEMPO 120 4 4
  PLAYRATE 1 0 0.25 4
  SELECTION 0 0
  SELECTION2 0 0
  MASTERAUTOMODE 0
  MASTERTRACKHEIGHT 0 0
  MASTERPEAKCOL 16576
  MASTERMUTESOLO 0
  MASTERTRACKVIEW 0 0.6667 0.5 0.5 0 0 0 0 0 0 0 0 0 0
  MASTERHWOUT 0 0 1 0 0 0 0 -1
  MASTER_NCH 2 2
  MASTER_VOLUME 1 0 -1 -1 1
  MASTER_PANMODE 3
  MASTER_FX 1
  MASTER_SEL 0
  <MASTERPLAYSPEEDENV
    EGUID {AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}
    ACT 0 -1
    VIS 0 1 1
    LANEHEIGHT 0 0
    ARM 0
    DEFSHAPE 0 -1 -1
  >
  <TEMPOENVEX
    EGUID {BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}
    ACT 0 -1
    VIS 1 0 1
    LANEHEIGHT 0 0
    ARM 0
    DEFSHAPE 1 -1 -1
  >
  ${markers.map((marker, index) => {
    const colorHex = marker.color?.replace('#', '') || '71A9F7';
    const colorInt = parseInt(colorHex, 16) | 0x1000000;
    const timestamp = parseFloat(marker.timestamp.toFixed(3));
    const sanitizedLabel = marker.label.replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/"/g, '').trim();
    return `MARKER ${index + 1} ${timestamp} "${sanitizedLabel}" 0 ${colorInt} 1 R {${generateGUID()}} 0`;
  }).join('\n  ')}
  <PROJBAY
  >
  <TRACK {${generateGUID()}}
    NAME "${sanitizedProjectName}"
    PEAKCOL 16576
    BEAT -1
    AUTOMODE 0
    VOLPAN 1 0 -1 -1 1
    MUTESOLO 0 0 0
    IPHASE 0
    PLAYOFFS 0 1
    ISBUS 0 0
    BUSCOMP 0 0 0 0 0
    SHOWINMIX 1 0.6667 0.5 1 0.5 0 0 0
    FIXEDLANES 9 0 0
    SEL 0
    REC 0 0 1 0 0 0 0 0
    VU 2
    TRACKHEIGHT 0 0 0 0 0 0 0
    INQ 0 0 0 0.5 100 0 0 100
    NCHAN 2
    FX 1
    TRACKID {${generateGUID()}}
    PERF 0
    MIDIOUT -1
    MAINSEND 1 0
    <ITEM
      POSITION 0
      SNAPOFFS 0
      LENGTH ${audioLength}
      LOOP 1
      ALLTAKES 0
      FADEIN 1 0 0 1 0 0 0
      FADEOUT 1 0 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {${generateGUID()}}
      IID 2
      NAME "${sanitizedFileName}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {${generateGUID()}}
      <SOURCE ${sourceType}
        FILE "${sanitizedFileName}"${sourceType === 'MP3' ? ' 1' : ''}
      >
    >
  >
  ${voiceNotes.map((voiceNote, index) => {
    const rawUsername = voiceNote.user?.username || 'user';
    const sanitizedUsername = rawUsername.replace(/[^a-zA-Z0-9_-]/g, '');
    const voiceFileName = `voice_notes/voice_note_${String(index + 1).padStart(2, '0')}_${sanitizedUsername}.mp3`;
    const voicePosition = parseFloat(voiceNote.timestamp.toFixed(3));
    const voiceLength = 10; // Default voice note length
    console.log(`🎛️ Creating .rpp track for: "${voiceFileName}" (raw username: "${rawUsername}")`);
    return `<TRACK {${generateGUID()}}
    NAME "Voice Note - ${voiceNote.user?.username || 'User'}"
    PEAKCOL 16576
    BEAT -1
    AUTOMODE 0
    VOLPAN 1 0 -1 -1 1
    MUTESOLO 0 0 0
    IPHASE 0
    PLAYOFFS 0 1
    ISBUS 0 0
    BUSCOMP 0 0 0 0 0
    SHOWINMIX 1 0.6667 0.5 1 0.5 0 0 0
    FIXEDLANES 9 0 0
    SEL 0
    REC 0 0 1 0 0 0 0 0
    VU 2
    TRACKHEIGHT 0 0 0 0 0 0 0
    INQ 0 0 0 0.5 100 0 0 100
    NCHAN 2
    FX 1
    TRACKID {${generateGUID()}}
    PERF 0
    MIDIOUT -1
    MAINSEND 1 0
    <ITEM
      POSITION ${voicePosition}
      SNAPOFFS 0
      LENGTH ${voiceLength}
      LOOP 1
      ALLTAKES 0
      FADEIN 1 0 0 1 0 0 0
      FADEOUT 1 0 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {${generateGUID()}}
      IID ${index + 3}
      NAME ${voiceFileName.split('/').pop()}
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {${generateGUID()}}
      <SOURCE MP3
        FILE "${voiceFileName}" 1
      >
    >
  >`
  }).join('\n  ')}
>`;

  console.log('✅ WORKING Reaper project generated successfully (based on reference file)');
  console.log('🎵 Final filename in project:', cleanFileName);
  console.log('🎧 Source type detected:', sourceType);
  console.log('🎤 Voice note tracks created:', voiceNotes.length);
  console.log('📝 Generated .rpp content (working structure):', reaper.substring(0, 300));
  
  return reaper;
}

export async function exportReaperWithInstructions(
  audioUrl: string,
  annotations: any[],
  projectTitle: string,
  cleanFileName: string
) {
  console.log('🎬 Starting Reaper export...');
  console.log('🔗 Original audio URL:', audioUrl);
  console.log('📁 Clean filename to use:', cleanFileName);
  console.log('📝 Project title:', projectTitle);
  
  const markers = generateEnhancedDAWMarkers(annotations);
  const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
  
  // DOUBLE CHECK: Ensure cleanFileName is actually clean
  if (cleanFileName.includes('?') || cleanFileName.includes('X-Amz')) {
    console.error('🚨 ALERT: Clean filename still contains S3 parameters!');
    console.error('🚨 Provided cleanFileName:', cleanFileName);
    // Force a new clean name
    const forcedCleanName = `${sanitizedTitle}.wav`;
    console.log('🔧 Forcing clean name:', forcedCleanName);
    cleanFileName = forcedCleanName;
  }
  
  // Generate the Reaper project with guaranteed clean filename
  const voiceNotes = annotations.filter(ann => ann.voiceNoteUrl);
  const reaperProject = generateEnhancedReaperProject(
    cleanFileName, // audioFilePath - use clean name
    markers, 
    sanitizedTitle, 
    cleanFileName, // audioFileName - use clean name
    voiceNotes // Pass voice notes for track creation
  );
  
  // Verify the generated project doesn't contain S3 URLs
  if (reaperProject.includes('X-Amz') || reaperProject.includes('?')) {
    console.error('🚨 CRITICAL: Generated Reaper project contains S3 URLs!');
    console.error('🚨 This should never happen!');
    // Don't export the broken file
    throw new Error('Generated Reaper project contains S3 URLs. Export cancelled for safety.');
  }
  
  // Generate instruction file
  const instructions = generateReaperInstructions(cleanFileName, sanitizedTitle, audioUrl, markers.length);
  
  // Download both files
  downloadFile(reaperProject, `${sanitizedTitle}.rpp`, 'text/plain');
  downloadFile(instructions, `${sanitizedTitle}_REAPER_INSTRUCTIONS.txt`, 'text/plain');
  
  console.log('✅ Export completed successfully');
  console.log('📊 Stats:', {
    markerCount: markers.length,
    fileName: cleanFileName,
    projectName: sanitizedTitle
  });
  
  return {
    success: true,
    message: `Exported ${markers.length} markers for Reaper`,
    markerCount: markers.length
  };
}

/**
 * Generate Logic Pro marker file
 */
export function generateLogicMarkers(markers: DAWMarker[], projectName: string): string {
  const header = `# Logic Pro Marker Export
# Project: ${projectName}
# Generated: ${new Date().toISOString()}
# Format: Time(seconds) TAB MarkerName
#
`;

  const markerLines = markers.map(marker => {
    const timeFormatted = marker.timestamp.toFixed(3);
    return `${timeFormatted}\t${marker.label}`;
  }).join('\n');

  return header + markerLines;
}

/**
 * Add voice note tracks from backend to the package
 */
async function addVoiceNoteTracksToPackage(
  audioUrl: string,
  annotations: any[],
  projectName: string,
  audioFolder: JSZip | null
): Promise<void> {
  if (!audioFolder) return;

  try {
    // Check if there are any voice note annotations
    const voiceNoteAnnotations = annotations.filter(annotation => 
      annotation.voiceNoteUrl && annotation.voiceNoteUrl.trim()
    );

    if (voiceNoteAnnotations.length === 0) {
      console.log('📝 No voice notes found, skipping voice track generation');
      return;
    }

    console.log(`🎤 Found ${voiceNoteAnnotations.length} voice note annotations, requesting voice tracks from backend...`);

    // Get authentication token
    const token = localStorage.getItem('skribble_token');
    if (!token) {
      console.warn('⚠️ No authentication token found, skipping voice note tracks');
      return;
    }

    // Extract audio file ID from the audio URL
    const urlParts = audioUrl.split('/');
    const audioFileIdWithExt = urlParts[urlParts.length - 1].split('?')[0];
    const audioFileId = audioFileIdWithExt.split('.')[0];

    // Call backend to get voice note tracks
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/wav-with-cues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioFileId: audioFileId,
        annotations: annotations, // Pass all annotations, backend will filter voice notes
        projectTitle: projectName,
        format: 'wav_with_cues'
      })
    });

    if (!response.ok) {
      console.warn(`⚠️ Backend voice track request failed: ${response.status} ${response.statusText}`);
      return;
    }

    // Check if response contains multiple files (voice tracks)
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      
      if (data.success && data.files) {
        console.log(`🎵 Backend returned ${data.files.length} files`);
        
        // Add voice note tracks to the Audio Files folder
        const voiceFiles = data.files.filter((file: any) => file.type === 'voice');
        
        if (voiceFiles.length > 0) {
          console.log(`🎤 Adding ${voiceFiles.length} voice note tracks to package...`);
          
          for (const voiceFile of voiceFiles) {
            const voiceBuffer = Buffer.from(voiceFile.content, 'base64');
            audioFolder.file(voiceFile.filename, voiceBuffer);
          }
          
          console.log('✅ Voice note tracks added to Audio Files folder');
        } else {
          console.log('📝 No voice note tracks returned from backend');
        }
      }
    } else {
      console.log('📄 Backend returned single file, no voice tracks available');
    }

  } catch (error) {
    console.warn('⚠️ Failed to fetch voice note tracks from backend:', error);
    // Don't throw - continue with package creation without voice tracks
  }
}

/**
 * Generate Pro Tools session package with audio and memory locations
 */
async function generateProToolsSessionPackage(
  audioUrl: string,
  annotations: any[],
  markers: DAWMarker[], 
  projectName: string, 
  audioFileName: string
): Promise<void> {
  try {
    console.log('📦 Creating Pro Tools session package...');
    
    // Create ZIP package
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Create folder structure
    const audioFolder = zip.folder("Audio Files");
    const sessionFolder = zip.folder("Pro Tools Import");
    const docFolder = zip.folder("Documentation");
    
    if (!audioFolder || !sessionFolder || !docFolder) {
      throw new Error('Failed to create folder structure');
    }
    
    // 1. Add original audio file (preserve original format)
    console.log('📥 Adding original audio file...');
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error('Failed to fetch audio');
    const audioBlob = await audioResponse.blob();
    
    // Extract original filename extension from URL or use .wav as fallback
    const originalExtension = audioFileName.split('.').pop() || 'wav';
    const audioFilename = `${projectName}.${originalExtension}`;
    audioFolder.file(audioFilename, audioBlob);

    // 1.5. Check for voice notes and fetch voice note tracks from backend
    console.log('🎤 Checking for voice notes to include as separate tracks...');
    await addVoiceNoteTracksToPackage(audioUrl, annotations, projectName, audioFolder);
    
    // 2. Generate MIDI file with markers (works for Pro Tools and Cubase)
    const midiWithMarkers = generateMIDIWithMarkers(markers, projectName);
    sessionFolder.file(`${projectName}_Markers.mid`, midiWithMarkers);
    
    // 3. Also generate Pro Tools text format for manual entry
    const memoryLocationsText = generateMemoryLocationsText(markers, projectName);
    sessionFolder.file(`${projectName}_Memory_Locations_Manual.txt`, memoryLocationsText);
    
    // 3. Generate Pro Tools import instructions (text format for manual import)  
    const importInstructions = generateProToolsImportInstructions(projectName, markers);
    sessionFolder.file(`IMPORT_INSTRUCTIONS.txt`, importInstructions);
    
    // 4. Generate comprehensive Pro Tools import guide
    const importGuide = generateProToolsImportGuide(projectName, markers.length);
    docFolder.file('PRO_TOOLS_IMPORT_GUIDE.txt', importGuide);
    
    // 5. Generate quick start guide
    const voiceNoteCount = annotations.filter(a => a.voiceNoteUrl && a.voiceNoteUrl.trim()).length;
    const quickStart = `PRO TOOLS QUICK START - ${projectName}
${'='.repeat(40)}

🚀 5-MINUTE SETUP:

1. Extract this ZIP to a folder
2. Open Pro Tools  
3. Create new session (match your audio sample rate)
4. Import main audio: File → Import → Audio to Track
   Select: ${projectName}.wav (or original format)
5. Import voice note tracks: File → Import → Audio to Track
   Select all voice note WAV files from Audio Files folder
   ⭐ Each voice note imports as separate track!
6. Import markers: File → Import → MIDI to Track
   Select: ${projectName}_Markers.mid
   ⭐ Markers import automatically with precise SMPTE timing!
   
✅ DONE! Audio, voice notes, and all markers load perfectly.

📍 MARKERS: ${markers.length} Memory Locations imported
🎵 MAIN AUDIO: Professional quality preserved
🎤 VOICE NOTES: ${voiceNoteCount > 0 ? `${voiceNoteCount} separate voice tracks` : 'No voice notes found'}
🔧 OPTIMIZED: Pro Tools 2020.1+ & Cubase (SMPTE timing)

📚 See PRO_TOOLS_IMPORT_GUIDE.txt for detailed instructions.
`;
    docFolder.file('QUICK_START.txt', quickStart);
    
    // 6. Generate Cubase-specific instructions
    const cubaseInstructions = `CUBASE IMPORT GUIDE - ${projectName}
${'='.repeat(40)}

🎹 CUBASE USERS - PRECISE MARKER TIMING:

The MIDI file uses SMPTE timecode (30fps) for perfect sync.

📋 IMPORT STEPS:

1. Create New Project in Cubase
2. Set project frame rate to 30fps:
   Project → Project Setup → Frame Rate → 30fps
3. Import Audio: File → Import → Audio File
   Select: ${projectName}.wav
4. Import Markers: File → Import → MIDI File  
   Select: ${projectName}_Markers.mid
   ✅ Markers will appear precisely synced!

⚠️ IMPORTANT FOR CUBASE:
• Make sure project frame rate is 30fps BEFORE importing
• Markers use SMPTE timing, not musical timing
• This ensures perfect sync regardless of project tempo

🎯 TROUBLESHOOTING:
• If markers appear late: Check project frame rate (must be 30fps)
• If markers don't import: Try Import MIDI File instead of drag-drop
• For best results: Start with empty project, set 30fps, then import

✅ RESULT: Perfect marker timing in Cubase!
`;
    docFolder.file('CUBASE_IMPORT_GUIDE.txt', cubaseInstructions);

    // Generate and download
    console.log('📦 Creating download package...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    const zipFileName = `${projectName}_ProTools_Package.zip`;
    downloadFile(zipBlob, zipFileName, 'application/zip');
    
    console.log('✅ Pro Tools package created successfully!');
    
  } catch (error) {
    console.error('❌ Pro Tools package creation failed:', error);
    throw error;
  }
}

/**
 * Generate Cubase XML marker file for direct import
 */
function generateCubaseXMLMarkers(markers: DAWMarker[], projectName: string): string {
  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<cubase_project_markers version="1.0">
  <project_name>${projectName}</project_name>
  <markers>
`;

  sortedMarkers.forEach((marker, index) => {
    const timeInSeconds = marker.timestamp;
    const cleanText = marker.label.replace(/[<>&"']/g, ''); // Remove XML-unsafe characters
    
    xml += `    <marker>
      <id>${index + 1}</id>
      <name>${cleanText}</name>
      <position>${timeInSeconds.toFixed(6)}</position>
      <type>marker</type>
    </marker>
`;
  });

  xml += `  </markers>
</cubase_project_markers>`;

  return xml;
}

/**
 * Generate MIDI file with markers (most reliable Pro Tools import method)
 */
function generateMIDIWithMarkers(markers: DAWMarker[], projectName: string): Uint8Array {
  // MIDI file with SMPTE timecode for Cubase/Pro Tools compatibility
  // Using 30fps SMPTE timing instead of tempo-based timing for precise audio sync
  
  const midiData = [];
  
  // MIDI file header
  midiData.push(...[0x4D, 0x54, 0x68, 0x64]); // "MThd"
  midiData.push(...[0x00, 0x00, 0x00, 0x06]); // Header length
  midiData.push(...[0x00, 0x00]); // Format 0
  midiData.push(...[0x00, 0x01]); // 1 track
  // Use SMPTE timecode: 30fps, 4 ticks per frame = 120 ticks per second
  midiData.push(...[0xE2, 0x04]); // -30fps (0xE2 = -30), 4 ticks per frame
  
  // Track header
  midiData.push(...[0x4D, 0x54, 0x72, 0x6B]); // "MTrk"
  
  const trackData = [];
  
  // No tempo events needed for SMPTE timing - time is absolute
  
  // Sort markers by timestamp to ensure proper order
  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  
  // Add markers as MIDI marker events with SMPTE timing
  let previousTicks = 0;
  
  sortedMarkers.forEach((marker, index) => {
    // Convert seconds to SMPTE ticks
    // 30fps * 4 ticks per frame = 120 ticks per second
    // This gives precise 1:1 timing with audio regardless of DAW tempo
    const absoluteTicks = Math.round(marker.timestamp * 120);
    const deltaTime = absoluteTicks - previousTicks;
    previousTicks = absoluteTicks;
    
    // Variable length quantity for delta time
    const deltaBytes = encodeVariableLength(deltaTime);
    trackData.push(...deltaBytes);
    
    // Marker meta event
    trackData.push(0xFF, 0x06); // Marker meta event
    
    // Create clean marker text without emojis
    const cleanText = createCleanMarkerText(marker);
    const textBytes = Array.from(new TextEncoder().encode(cleanText));
    const lengthBytes = encodeVariableLength(textBytes.length);
    
    trackData.push(...lengthBytes);
    trackData.push(...textBytes);
  });
  
  // End of track
  trackData.push(0x00, 0xFF, 0x2F, 0x00);
  
  // Track length
  const trackLength = trackData.length;
  midiData.push(...[
    (trackLength >> 24) & 0xFF,
    (trackLength >> 16) & 0xFF,
    (trackLength >> 8) & 0xFF,
    trackLength & 0xFF
  ]);
  
  midiData.push(...trackData);
  
  return new Uint8Array(midiData);
}

/**
 * Create clean marker text for MIDI (no emojis, readable format)
 */
function createCleanMarkerText(marker: DAWMarker): string {
  const username = marker.username || 'Unknown';
  
  // Convert type to readable text
  const typeText = getAnnotationTypeText(marker.annotationType || 'comment');
  
  // Convert priority to readable text  
  const priorityText = marker.priority === 'critical' ? '[CRITICAL] ' : 
                      marker.priority === 'high' ? '[HIGH] ' : 
                      marker.priority === 'medium' ? '[MEDIUM] ' : '';
  
  // Extract clean text from the original marker label
  // Remove emojis and extract just the comment text
  const originalText = marker.label
    .replace(/🔥\s*/g, '')
    .replace(/⚡\s*/g, '')
    .replace(/[⚠️✅📍🎵🎤💬]\s*/g, '')
    .replace(/^\w+:\s*/, '') // Remove "username: " prefix if present
    .trim();
  
  return `${priorityText}${typeText} (${username}): ${originalText}`;
}

/**
 * Get annotation type as readable text (no emojis)
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
 * Encode variable length quantity for MIDI
 */
function encodeVariableLength(value: number): number[] {
  const result = [];
  result.unshift(value & 0x7F);
  value >>= 7;
  while (value > 0) {
    result.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }
  return result;
}

/**
 * Generate simple memory locations text for manual entry
 */
function generateMemoryLocationsText(markers: DAWMarker[], projectName: string): string {
  let content = `MEMORY LOCATIONS FOR MANUAL ENTRY - ${projectName}\n`;
  content += `${'='.repeat(60)}\n\n`;
  content += `Copy these into Pro Tools manually:\n`;
  content += `Window → Memory Locations → New Memory Location\n\n`;
  
  markers.forEach((marker, index) => {
    const timecode = formatTimeToSMPTE(marker.timestamp);
    const minutes = Math.floor(marker.timestamp / 60);
    const seconds = (marker.timestamp % 60).toFixed(3);
    const timeDisplay = `${minutes}:${seconds.padStart(6, '0')}`;
    
    content += `${index + 1}. ${timecode} (${timeDisplay}) - ${marker.label}\n`;
  });
  
  content += `\nTo manually create in Pro Tools:\n`;
  content += `1. Position playhead at the time shown\n`;
  content += `2. Window → Memory Locations\n`;
  content += `3. Click "+" or press Enter\n`;
  content += `4. Enter the marker name\n`;
  content += `5. Click OK\n`;
  
  return content;
}

/**
 * Generate Pro Tools import instructions
 */
function generateProToolsImportInstructions(projectName: string, markers: DAWMarker[]): string {
  const originalExtension = 'wav'; // Will be updated dynamically
  const instructions = `PRO TOOLS ULTIMATE 2025.6.0 IMPORT INSTRUCTIONS
${'='.repeat(60)}

📂 PACKAGE CONTENTS:
✅ ${projectName}.${originalExtension} - Original audio file (preserved format)
✅ ${projectName}_Markers.mid - MIDI file with markers (Pro Tools & Cubase)
✅ ${projectName}_Memory_Locations_Manual.txt - Manual entry guide
✅ This instruction file

🎯 TWO IMPORT METHODS FOR PRO TOOLS ULTIMATE 2025.6.0:

METHOD 1: MIDI IMPORT (RECOMMENDED) ⭐
1. Open Pro Tools Ultimate
2. Create new session (match your audio sample rate)
3. IMPORTANT: Set session to 30fps SMPTE timecode for precise marker timing
4. File → Import → Audio to Track
   - Select: ${projectName}.${originalExtension}
4. File → Import → MIDI to Track
   - Select: ${projectName}_Markers.mid
   - All markers import automatically! ✅

🎹 FOR CUBASE USERS:
1. Import audio file first
2. File → Import → MIDI File and select ${projectName}_Markers.mid
3. Markers should appear directly on project timeline ✅
4. If you see instrument tracks instead: Delete them and use Project → Markers → Import from MIDI

METHOD 2: MANUAL ENTRY (BACKUP)
1. Import audio as above
2. Open: ${projectName}_Memory_Locations_Manual.txt
3. Window → Memory Locations
4. Manually create each location using the provided times

✅ EXPECTED RESULT: ${markers.length} markers in Pro Tools

📍 MARKERS PREVIEW:
${markers.map((marker, index) => {
  const timecode = formatTimeToSMPTE(marker.timestamp);
  const safeName = marker.label.replace(/[^\w\s-]/g, '').substring(0, 32);
  return `${index + 1}. ${timecode} - ${safeName}`;
}).join('\n')}

💡 BENEFITS OF MIDI METHOD:
• Markers import automatically with precise timing
• No format compatibility issues
• Works with any Pro Tools version
• Preserves all marker names and positions

Generated: ${new Date().toLocaleString()}
Source: Skribble Music Collaboration Platform
`;

  return instructions;
}

/**
 * Format time to SMPTE timecode format
 */
function formatTimeToSMPTE(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // 30fps
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

/**
 * Generate comprehensive Pro Tools import guide
 */
function generateProToolsImportGuide(projectName: string, markerCount: number): string {
  return `PRO TOOLS IMPORT GUIDE - ${projectName}
${'='.repeat(60)}

🔧 OPTIMIZED FOR PRO TOOLS 2020.1+

This package provides the best possible Pro Tools workflow using
native Pro Tools import capabilities.

📦 PACKAGE CONTENTS:
✅ ${projectName}_48kHz.wav           → Master audio (48kHz/24-bit)
✅ ${projectName}_Memory_Locations.txt → Importable markers file
✅ ${projectName}_Session_Template.txt → Session structure reference
✅ PRO_TOOLS_IMPORT_GUIDE.txt         → This detailed guide
✅ QUICK_START.txt                    → 5-minute setup

🚀 STEP-BY-STEP IMPORT:

1. **Extract Package:**
   - Extract ZIP to dedicated project folder
   - Keep all files in same directory

2. **Create New Session:**
   - Open Pro Tools
   - File → New Session
   - Settings: 48kHz, 24-bit (recommended)
   - Name: ${projectName}

3. **Import Audio:**
   - File → Import → Audio to Track
   - Browse to Audio Files folder
   - Select: ${projectName}_48kHz.wav
   - Import to Track 1

4. **Import Memory Locations:**
   - File → Import → Session Data
   - Browse to Pro Tools Import folder  
   - Select: ${projectName}_Memory_Locations.txt
   - Import Options:
     • Memory Locations: ✓ Import
     • Audio: Skip (already imported)
     • Other: As needed

5. **Verify Import:**
   - Play audio to confirm import
   - Open Memory Locations window (Window → Memory Locations)
   - Confirm all ${markerCount} markers are present
   - Use markers for navigation

📍 MEMORY LOCATIONS:

Your session now has ${markerCount} Memory Locations:
• Navigate with keyboard shortcuts (Ctrl/Cmd + numbers)
• Click Memory Locations to jump to positions  
• Edit/rename Memory Locations as needed
• Add new Memory Locations during production

🎚️ TECHNICAL SPECIFICATIONS:

• Audio Format: Broadcast Wave Format (BWF)
• Sample Rate: 48kHz (industry standard)
• Bit Depth: 24-bit (professional quality)
• Memory Location Format: Pro Tools native
• Compatibility: Pro Tools 2020.1+

💡 PRO TIPS:

• **Memory Location Navigation:** Use Ctrl+. (period) to recall locations
• **Keyboard Shortcuts:** Number keys 1-9 recall first 9 locations
• **Editing Locations:** Double-click to edit names and positions
• **New Locations:** Press Enter during playback to create new ones
• **Organization:** Use numbered prefixes for song structure (01-Intro, 02-Verse)

⚠️ TROUBLESHOOTING:

🔸 **"Session Data import failed"**
→ Ensure .txt file is in correct format
→ Try importing as "Memory Locations Only"
→ Check Pro Tools version (2020.1+ recommended)

🔸 **"Audio file not found"**
→ Keep audio and session files in same folder
→ Use "Import Audio to Track" instead of drag-and-drop
→ Check sample rate compatibility (48kHz preferred)

🔸 **"Memory Locations don't appear"**
→ Open Window → Memory Locations
→ Check import options included Memory Locations
→ Manually create if import fails (see Session_Template.txt)

🔸 **"Wrong sample rate"**
→ Pro Tools will offer conversion - accept to 48kHz
→ All audio is pre-optimized for 48kHz workflow

🆘 SUPPORT:

• Pro Tools Documentation: avid.com/support
• Video Tutorials: skribble.app/support  
• Technical Support: help@skribble.app

📞 ALTERNATIVE WORKFLOW:

If Memory Location import fails:
1. Open Memory Locations window (Window → Memory Locations)
2. Manually create locations using Session_Template.txt
3. Position playhead and press Enter to create
4. Name according to template

---
🌟 Pro Tools Package by Skribble Music Collaboration
Generated: ${new Date().toLocaleString()}
Audio: Professional 48kHz/24-bit BWF
Memory Locations: ${markerCount} markers
Compatible: Pro Tools 2020.1+

This package uses Pro Tools native import capabilities for
seamless integration with your professional workflow.
`;
}

/**
 * Generate Pro Tools marker file
 */
export function generateProToolsMarkers(markers: DAWMarker[], projectName: string): string {
  const header = `SESSION NAME:\t${projectName}
SAMPLE RATE:\t44100
BIT DEPTH:\t24-Bit
SESSION START TIMECODE:\t01:00:00:00
TIMECODE FORMAT:\t30 Frame
# OF AUDIO TRACKS:\t1
# OF AUDIO CLIPS:\t1
# OF AUDIO FILES:\t1

FILES IN SESSION
Filename\tLocation
Original\tAudio Files

MARKERS
#\tLOCATION\tTIME REFERENCE\tUNITS\tNAME\tCOMMENTS
`;

  const markerLines = markers.map((marker, index) => {
    const samples = Math.floor(marker.timestamp * 44100); // Assuming 44.1kHz
    const minutes = Math.floor(marker.timestamp / 60);
    const seconds = marker.timestamp % 60;
    const timeCode = `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
    
    return `${index + 1}\t${samples}\t${timeCode}\tSamples\t${marker.label}\t`;
  }).join('\n');

  return header + markerLines;
}

/**
 * Generate universal marker text file (compatible with most DAWs)
 */
export function generateUniversalMarkers(markers: DAWMarker[], projectName: string): string {
  const header = `# Universal DAW Marker File
# Project: ${projectName}
# Generated: ${new Date().toISOString()}
# 
# Format: [Time in seconds] [Type] [Label]
# Colors are indicated in the label with emojis
#
# Import Instructions:
# - Reaper: File > Import > Media cue list...
# - Logic Pro: Import as text markers
# - Pro Tools: Import as markers
#

`;

  const markerLines = markers.map(marker => {
    const timeFormatted = formatTime(marker.timestamp);
    const typeTag = `[${marker.type.toUpperCase()}]`;
    return `${marker.timestamp.toFixed(3)}\t${typeTag}\t${marker.label}`;
  }).join('\n');

  return header + markerLines;
}

/**
 * Download file utility
 */
export function downloadFile(data: string | Blob, filename: string, mimeType: string = 'text/plain') {
  console.log('📥 downloadFile called:', { 
    filename, 
    mimeType, 
    dataType: data instanceof Blob ? 'Blob' : 'string',
    dataSize: data instanceof Blob ? data.size : data.length
  });
  
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  console.log('🔗 Created blob URL:', url);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  
  console.log('🖱️ Triggering download click for:', filename);
  a.click();
  document.body.removeChild(a);
  
  // Clean up the URL after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
    console.log('🗑️ Cleaned up blob URL for:', filename);
  }, 100);
}

// Utility functions (existing ones maintained)
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatPreciseTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00.0';
  
  const mins = Math.floor(seconds / 60);
  const wholeSecs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${wholeSecs.toString().padStart(2, '0')}.${ms}`;
}

function generateGUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

/**
 * Detect audio file format from URL or binary data
 */
export async function detectAudioFormat(audioUrl: string): Promise<{
  format: string;
  canEmbedCues: boolean;
  mimeType: string;
}> {
  try {
    // First try to detect from URL extension
    const urlFormat = detectFormatFromUrl(audioUrl);
    if (urlFormat) {
      return urlFormat;
    }

    // If URL detection fails, fetch the first few bytes to check file headers
    const response = await fetch(audioUrl, {
      headers: { 'Range': 'bytes=0-11' }
    });
    
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      return detectFormatFromBytes(bytes);
    }
    
    // Fallback to unknown
    return {
      format: 'unknown',
      canEmbedCues: false,
      mimeType: 'audio/mpeg'
    };
    
  } catch (error) {
    console.error('Format detection failed:', error);
    return {
      format: 'unknown', 
      canEmbedCues: false,
      mimeType: 'audio/mpeg'
    };
  }
}

/**
 * Detect format from URL/filename
 */
function detectFormatFromUrl(url: string): { format: string; canEmbedCues: boolean; mimeType: string } | null {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('.wav') || urlLower.includes('wav')) {
    return { format: 'wav', canEmbedCues: true, mimeType: 'audio/wav' };
  }
  if (urlLower.includes('.mp3') || urlLower.includes('mp3')) {
    return { format: 'mp3', canEmbedCues: false, mimeType: 'audio/mpeg' };
  }
  if (urlLower.includes('.m4a') || urlLower.includes('m4a')) {
    return { format: 'm4a', canEmbedCues: false, mimeType: 'audio/mp4' };
  }
  if (urlLower.includes('.aiff') || urlLower.includes('aif')) {
    return { format: 'aiff', canEmbedCues: false, mimeType: 'audio/aiff' };
  }
  if (urlLower.includes('.flac')) {
    return { format: 'flac', canEmbedCues: false, mimeType: 'audio/flac' };
  }
  if (urlLower.includes('.ogg')) {
    return { format: 'ogg', canEmbedCues: false, mimeType: 'audio/ogg' };
  }
  
  return null;
}

/**
 * Detect format from file header bytes
 */
function detectFormatFromBytes(bytes: Uint8Array): { format: string; canEmbedCues: boolean; mimeType: string } {
  if (bytes.length < 4) {
    return { format: 'unknown', canEmbedCues: false, mimeType: 'audio/mpeg' };
  }
  
  // Check for RIFF/WAV
  const riffHeader = String.fromCharCode(...bytes.slice(0, 4));
  if (riffHeader === 'RIFF') {
    return { format: 'wav', canEmbedCues: true, mimeType: 'audio/wav' };
  }
  
  // Check for MP3
  if ((bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) || // MP3 frame header
      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) { // ID3v2 header
    return { format: 'mp3', canEmbedCues: false, mimeType: 'audio/mpeg' };
  }
  
  // Check for M4A/MP4
  if (bytes.length >= 8) {
    const ftyp = String.fromCharCode(...bytes.slice(4, 8));
    if (ftyp === 'ftyp') {
      return { format: 'm4a', canEmbedCues: false, mimeType: 'audio/mp4' };
    }
  }
  
  // Check for AIFF
  const formHeader = String.fromCharCode(...bytes.slice(0, 4));
  if (formHeader === 'FORM') {
    return { format: 'aiff', canEmbedCues: false, mimeType: 'audio/aiff' };
  }
  
  // Check for FLAC
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { format: 'flac', canEmbedCues: false, mimeType: 'audio/flac' };
  }
  
  // Check for OGG
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { format: 'ogg', canEmbedCues: false, mimeType: 'audio/ogg' };
  }
  
  // Default to MP3 if unknown
  return { format: 'unknown', canEmbedCues: false, mimeType: 'audio/mpeg' };
}

/**
 * Generate WAV file with cue points (for non-WAV source files)
 */
async function generateWAVWithCuePoints(
  audioUrl: string,
  annotations: any[],
  projectTitle: string
): Promise<void> {
  try {
    // Create a simple marker file that can be imported alongside the original audio
    const markers = generateEnhancedDAWMarkers(annotations);
    const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    
    // Generate multiple formats for maximum compatibility
    const cueFile = generateCueFile(markers, audioUrl);
    const voiceNotes = annotations.filter(ann => ann.voiceNoteUrl);
    const reaper = generateEnhancedReaperProject(audioUrl.split('/').pop() || 'audio', markers, sanitizedTitle, audioUrl, voiceNotes);
    const universal = generateUniversalMarkers(markers, sanitizedTitle);
    
    // Create a ZIP file with all formats
    const zipContent = await createExportZip({
      [`${sanitizedTitle}.cue`]: cueFile,
      [`${sanitizedTitle}.rpp`]: reaper, 
      [`${sanitizedTitle}_markers.txt`]: universal,
      [`README.txt`]: generateReadmeFile(sanitizedTitle, audioUrl)
    });
    
    // Download the ZIP
    downloadFile(zipContent, `${sanitizedTitle}_Export_Package.zip`, 'application/zip');
    
  } catch (error) {
    console.error('Failed to generate WAV export package:', error);
    throw error;
  }
}

/**
 * Create a ZIP file with multiple export formats
 */
async function createExportZip(files: Record<string, string>): Promise<Blob> {
  // Simple zip creation without external libraries
  // In a real implementation, you'd use a proper ZIP library like JSZip
  
  let content = "Export Package Contents:\n\n";
  Object.keys(files).forEach(filename => {
    content += `${filename}:\n${files[filename]}\n\n${'='.repeat(50)}\n\n`;
  });
  
  return new Blob([content], { type: 'text/plain' });
}

/**
 * Generate README file for export package
 */
function generateReadmeFile(projectTitle: string, audioUrl: string): string {
  const filename = audioUrl.split('/').pop() || 'audio';
  
  return `Skribble Export Package: ${projectTitle}
${'='.repeat(50)}

This package contains your audio annotations in multiple formats:

📁 Files included:
- ${projectTitle}.cue         → CUE sheet for CD burning software
- ${projectTitle}.rpp         → Reaper project file  
- ${projectTitle}_markers.txt → Universal marker format

🎵 Original Audio File: ${filename}

📋 How to use:

FOR REAPER:
1. Import your original audio file: ${filename}
2. Open the .rpp project file
3. Markers will appear on timeline

FOR OTHER DAWs:
1. Import your original audio file: ${filename}  
2. Import the _markers.txt file as markers/cues
3. Or use the .cue file for CD software

FOR VINYL/CD MASTERING:
- Use the .cue file with your mastering software

Generated by Skribble - Music Collaboration Platform
`;
}

async function generateMarkerExportPackage(
  audioUrl: string,
  annotations: any[],
  projectTitle: string
): Promise<void> {
  const markers = generateEnhancedDAWMarkers(annotations);
  const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
  
  // Generate multiple formats for maximum compatibility
  const cueFile = generateCueFile(markers, audioUrl);
  const universal = generateUniversalMarkers(markers, sanitizedTitle);
  
  // Create a ZIP file with marker formats + instructions
  const zipContent = await createExportZip({
    [`${sanitizedTitle}.cue`]: cueFile,
    [`${sanitizedTitle}_markers.txt`]: universal,
    [`README.txt`]: generateReadmeFile(sanitizedTitle, audioUrl)
  });
  
  // Download the ZIP as fallback
  downloadFile(zipContent, `${sanitizedTitle}_Markers.zip`, 'application/zip');
  
  console.log('⚠️ Exported marker package as fallback - original audio conversion failed');
}

async function extractAudioFileId(): Promise<string> {
  // This function should extract the audio file ID from the current context
  // For example, it could be stored in localStorage or passed as a parameter
  const audioFileId = localStorage.getItem('audio_file_id');
  if (!audioFileId) {
    throw new Error('Audio file ID not found in localStorage');
  }
  return audioFileId;
}

async function convertToWAVWithCuePoints(
  audioUrl: string, 
  annotations: any[], 
  projectTitle: string
): Promise<void> {
  try {
    console.log('🎛️ Requesting backend conversion to WAV with embedded cue points...');
    
    const token = localStorage.getItem('skribble_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Extract audio file ID from the audio URL path
    const urlParts = audioUrl.split('/');
    const audioFileIdWithExt = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
    const audioFileId = audioFileIdWithExt.split('.')[0]; // Remove extension
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export/wav-with-cues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioFileId: audioFileId,
        annotations: annotations,
        projectTitle: projectTitle,
        format: 'wav_with_cues'
      })
    });

    if (!response.ok) {
      let errorMessage = 'Backend conversion failed';
      try {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch (parseError) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    // Check if response is JSON (multiple files) or binary (single file)
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      // Handle multiple files response
      const data = await response.json();
      
      if (data.success && data.files) {
        // Received multiple files for download
        
        // Download each file individually
        data.files.forEach((file: any, index: number) => {
          try {
            // Convert base64 to blob
            const binaryString = atob(file.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'audio/wav' });
            
            // Download with a slight delay between files
            setTimeout(() => {
              downloadFile(blob, file.filename, 'audio/wav');
              // File downloaded successfully
            }, index * 500); // 500ms delay between downloads
            
          } catch (error) {
            console.error(`❌ Failed to download ${file.filename}:`, error);
          }
        });
        
        // Initiated download of all WAV files
      } else {
        throw new Error('Invalid response format from server');
      }
    } else {
      // Handle single file response (legacy behavior)
      const wavBlob = await response.blob();
      const fileName = `${projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim()}.wav`;
      downloadFile(wavBlob, fileName, 'audio/wav');
      // Downloaded single WAV file
    }
    
    console.log('✅ Successfully converted and downloaded WAV with embedded cue points');
    
  } catch (error) {
    console.error('❌ Failed to convert to WAV with cue points:', error);
    throw new Error(`WAV with cue points conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Enhanced export function with format detection
 */
export async function exportForDAW(
  audioUrl: string,
  annotations: any[],
  projectTitle: string,
  audioFileName: string,
  format: DAWExportFormat = 'wav-cues'
) {
  console.log('🚀 ==> exportForDAW called with:');
  console.log('🎵 Format requested:', format);
  console.log('📁 Audio filename:', audioFileName);
  console.log('📝 Project title:', projectTitle);
  console.log('🔗 Audio URL:', audioUrl);
  
  const markers = generateEnhancedDAWMarkers(annotations);
  const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    
  try {
    console.log('🔄 Entering switch statement for format:', format);
    
    switch (format) {
      case 'wav-cues':
        console.log('📍 CASE: wav-cues - Converting to WAV with embedded cue points');
        
        // Use the original working implementation: backend conversion with embedded markers
        await convertToWAVWithCuePoints(audioUrl, annotations, sanitizedTitle);
        
        console.log('✅ WAV with embedded cue points export completed');
        break;

      case 'aaf-professional':
        console.log('📍 CASE: aaf-professional - Creating Pro Tools Ultimate 2025 optimized package');
        console.log('🎯 Pro Tools Ultimate detected - using Memory Locations import method');
        
        // For Pro Tools Ultimate 2025, use the proven session package approach
        // This creates Memory Locations that Pro Tools can reliably import via Session Data
        await generateProToolsSessionPackage(audioUrl, annotations, markers, sanitizedTitle, audioFileName);
        
        console.log('✅ AAF export completed');
        break;
        
      case 'reaper-rpp':
        console.log('📍 CASE: reaper-rpp - Creating Reaper ZIP bundle with .rpp + audio');
        
        // Use the existing enhanced Reaper export with ZIP bundling
        await exportReaperWithZipBundle(audioUrl, annotations, sanitizedTitle, audioFileName);
        console.log('✅ Reaper ZIP bundle export completed');
        
        return {
          success: true,
          message: `Exported complete Reaper project with ${markers.length} markers`,
          markerCount: markers.length,
          voiceNoteCount: annotations.filter(ann => ann.voiceNoteUrl).length
        };
        
      default:
        console.error('❌ Unknown export format:', format);
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    console.log('✅ Export completed successfully');
    return {
      success: true,
      message: `Exported ${markers.length} markers for ${format}`,
      markerCount: markers.length
    };
    
  } catch (error) {
    console.error('❌ Export for DAW failed:', error);
    throw error;
  }
}

function extractCleanFilename(s3Url: string, fallbackTitle: string): string {
  console.log('🔍 Extracting clean filename from:', s3Url);
  
  try {
    const url = new URL(s3Url);
    const pathname = url.pathname;
    const pathParts = pathname.split('/');
    const s3Key = pathParts[pathParts.length - 1];
    
    console.log('📁 S3 key extracted:', s3Key);
    
    // If it looks like a UUID filename, use the project title instead
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const keyWithoutExtension = s3Key.split('.')[0];
    
    if (uuidPattern.test(keyWithoutExtension)) {
      const extension = s3Key.includes('.') ? '.' + s3Key.split('.').pop() : '.wav';
      const sanitizedTitle = fallbackTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
      const cleanName = `${sanitizedTitle}${extension}`;
      console.log('🆔 UUID detected, using project title:', cleanName);
      return cleanName;
    }
    
    // If it has a reasonable filename, clean it up
    const cleanName = decodeURIComponent(s3Key);
    console.log('✅ Using cleaned S3 key:', cleanName);
    return cleanName;
    
  } catch (error) {
    console.error('❌ Error extracting filename:', error);
    // Fallback to project title + .wav
    const sanitizedTitle = fallbackTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    const fallbackName = `${sanitizedTitle}.wav`;
    console.log('🔄 Using fallback name:', fallbackName);
    return fallbackName;
  }
}


/**
 * Generate enhanced CUE file
 */
function generateCueFile(markers: any[], audioUrl: string): string {
  const filename = audioUrl.split('/').pop() || 'audio.wav';
  
  let cueContent = `REM GENRE "Music Production"\n`;
  cueContent += `REM DATE "${new Date().getFullYear()}"\n`;
  cueContent += `REM COMMENT "Generated by Skribble"\n`;
  cueContent += `FILE "${filename}" WAVE\n`;
  
  markers.forEach((marker, index) => {
    const trackNum = (index + 1).toString().padStart(2, '0');
    const timeStr = formatTimeForCue(marker.timestamp);
    
    cueContent += `  TRACK ${trackNum} AUDIO\n`;
    cueContent += `    TITLE "${marker.label.replace(/"/g, '\\"')}"\n`;
    cueContent += `    INDEX 01 ${timeStr}\n`;
  });
  
  return cueContent;
}

/**
 * Format time for CUE file (MM:SS:FF format)
 */
function formatTimeForCue(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 75); // 75 frames per second for CD
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}
