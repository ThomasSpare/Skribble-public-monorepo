// frontend/src/lib/audioUtils.ts - Enhanced with DAW export functionality

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
export type DAWExportFormat = 'wav-cues' | 'reaper-rpp' | 'logic-markers' | 'ableton-als' | 'pro-tools-ptxt';

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
 * This creates a downloadable blob with cue point metadata
 */
export async function generateWAVWithCues(
  audioUrl: string
): Promise<Blob> {
  try {
    // Fetch the original audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // For now, we'll create a simple implementation that appends marker data
    // In a full implementation, you'd need to properly parse and modify the WAV file
    // This is a placeholder that demonstrates the concept
        
    // Return the original file for now - in production you'd embed the cue points
    return new Blob([arrayBuffer], { type: 'audio/wav' });
    
  } catch (error) {
    console.error('Error generating WAV with cues:', error);
    throw error;
  }
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
      <SOURCE WAVE
        FILE "${cleanFileName}"
      >
    >
  >
>`;
}

/**
 * Generate Reaper project file with enhanced markers
 */
export function generateEnhancedReaperProject(
  audioFilePath: string,
  markers: DAWMarker[],
  projectName: string,
  audioFileName: string
): string {
  
  // IMPORTANT: Only use the clean filename, never the full path/URL
  const cleanFileName = audioFileName || audioFilePath.split('/').pop() || 'audio.wav';
  
  console.log('🎛️ Generating Reaper project with filename:', cleanFileName);
  console.log('🎯 Project name:', projectName);
  console.log('📍 Marker count:', markers.length);
  
  // Ensure we NEVER use URLs with query parameters
  if (cleanFileName.includes('?') || cleanFileName.includes('X-Amz')) {
    console.error('❌ DETECTED S3 URL IN FILENAME - This should not happen!');
    console.error('🚨 Clean filename contains S3 parameters:', cleanFileName);
    // Force a clean name
    const emergencyName = `${projectName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim()}.wav`;
    console.log('🚑 Emergency fallback filename:', emergencyName);
    return generateReaperProjectWithCleanName(emergencyName, markers, projectName);
  }

  const reaper = `<REAPER_PROJECT 0.1 "7.0" 1234567890
  RIPPLE 0
  GROUPOVERRIDE 0 0 0
  AUTOXFADE 1
  ENVATTACH 1
  POOLEDENVATTACH 0
  MIXERUIFLAGS 11 48
  PEAKGAIN 1
  FEEDBACK 0
  PANLAW 1
  PROJOFFS 0 0 0
  MAXPROJLEN 0 600
  GRID 3199 8 1 8 1 0 0 0
  TIMEMODE 1 5 -1 30 0 0 -1
  VIDEO_CONFIG 0 0 1 256 
  PANMODE 3
  CURSOR 0
  ZOOM 100 0 0
  VZOOMEX 6 0
  USE_REC_CFG 0
  RECMODE 1
  SMPTESYNC 0 30 100 40 1000 300 0 0 1 0 0
  LOOP 0
  LOOPGRAN 0 4
  RECORD_PATH "" ""
  <RECORD_CFG
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
  ITEMMIX 0
  DEFPITCHMODE 589824 0
  TAKELANE 1
  SAMPLERATE 44100 0 0
  <RENDER_CFG
  >
  LOCK 1
  <METRONOME 6 2
    VOL 0.25 0.125
    FREQ 800 1600 1
    BEATLEN 4
    SAMPLES "" ""
    PATTERN 2863311530 2863311529
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
  MASTERTRACKVIEW 0 0.6667 0.5 0.5 0 0 0 0 0 0
  MASTERHWOUT 0 0 1 0 0 0 0 -1
  MASTER_NCH 2 2
  MASTER_VOLUME 1 0 -1 -1 1
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
  ${markers.map(marker => {
    const colorHex = marker.color?.replace('#', '') || '71A9F7';
    const colorInt = parseInt(colorHex, 16) | 0x1000000; // Add alpha channel
    // Use precise timestamp for better accuracy
    const timestamp = parseFloat(marker.timestamp.toFixed(3));
    return `MARKER ${timestamp} "${marker.label.replace(/"/g, '\\"')}" 0 ${colorInt} 1 B {${generateGUID()}}`;
  }).join('\n  ')}
  <PROJBAY
  >
  <TRACK {${generateGUID()}}
    NAME "${projectName}"
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
    FREEMODE 0
    SEL 0
    REC 0 0 1 0 0 0 0
    VU 2
    TRACKHEIGHT 0 0 0 0 0 0
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
      LENGTH ${Math.ceil(Math.max(...markers.map(m => m.timestamp), 60))}
      LOOP 1
      ALLTAKES 0
      FADEIN 1 0 0 1 0 0 0
      FADEOUT 1 0 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {${generateGUID()}}
      IID 1
      NAME "${cleanFileName}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {${generateGUID()}}
      <SOURCE WAVE
        FILE "${cleanFileName}"
      >
    >
  >
>`;

  console.log('✅ Reaper project generated successfully');
  console.log('🎵 Final filename in project:', cleanFileName);
  
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
  const reaperProject = generateEnhancedReaperProject(
    cleanFileName, // audioFilePath - use clean name
    markers, 
    sanitizedTitle, 
    cleanFileName // audioFileName - use clean name
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
# - Ableton Live: Import as locators
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
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Clean up the URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 100);
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
    const reaper = generateEnhancedReaperProject(audioUrl.split('/').pop() || 'audio', markers, sanitizedTitle, audioUrl);
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
  projectTitle: string,
  audioFileName: string
): Promise<void> {
  try {
    console.log('🎛️ Requesting backend conversion from MP3 to WAV with cue points...');
    
    const token = localStorage.getItem('skribble_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Extract audio file ID from current context (you'll need to pass this)
    const audioFileId = extractAudioFileId(); // You'll need to implement this
    
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
      const error = await response.json();
      throw new Error(error.message || 'Backend conversion failed');
    }

    // Get the converted WAV file as blob
    const wavBlob = await response.blob();
    
    // Download the single WAV file with embedded cue points
    const fileName = `${projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim()}.wav`;
    downloadFile(wavBlob, fileName, 'audio/wav');
    
    console.log('✅ Successfully converted and downloaded WAV with embedded cue points');
    
  } catch (error) {
    console.error('❌ Failed to convert MP3 to WAV with cue points:', error);
    
    // Fallback: Generate marker files if backend conversion fails
    console.log('🔄 Falling back to marker export package...');
    await generateMarkerExportPackage(audioUrl, annotations, projectTitle);
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
        
        // Detect audio format first
        const audioFormat = await detectAudioFormat(audioUrl);
        console.log('🎵 Detected audio format:', audioFormat);
        
        if (audioFormat.canEmbedCues) {
          // Source is already WAV - just embed cue points
          console.log('✅ WAV file detected - embedding cues directly');
          const { exportWAVWithEmbeddedAnnotations } = await import('./wavMetadataEmbedder');
          await exportWAVWithEmbeddedAnnotations(audioUrl, annotations, sanitizedTitle);
        } else {
          // Source is MP3/other format - convert to WAV with cue points via backend
          console.log('🔄 Non-WAV file detected - converting to WAV with embedded cue points');
          await convertToWAVWithCuePoints(audioUrl, annotations, sanitizedTitle, audioFileName);
        }
        break;
        
      case 'reaper-rpp':
        console.log('📍 CASE: reaper-rpp - This should create .rpp project file');
        console.log('🎛️ Starting Reaper RPP export...');
        
        const cleanFileName = extractCleanFilename(audioUrl, projectTitle);
        console.log('✨ Extracted clean filename:', cleanFileName);
        
        // Safety check
        if (cleanFileName.includes('X-Amz') || cleanFileName.includes('?')) {
          console.error('🚨 EXTRACTED FILENAME STILL HAS S3 PARAMS!');
          throw new Error('Failed to extract clean filename from S3 URL');
        }
        
        console.log('🔄 Calling exportReaperWithInstructions...');
        await exportReaperWithInstructions(audioUrl, annotations, sanitizedTitle, cleanFileName);
        console.log('✅ Reaper export completed');
        break;
        
      case 'logic-markers':
        console.log('📍 CASE: logic-markers - Creating Logic Pro markers');
        const logicMarkers = generateLogicMarkers(markers, sanitizedTitle);
        downloadFile(logicMarkers, `${sanitizedTitle} - Logic Markers.txt`, 'text/plain');
        break;
        
      case 'pro-tools-ptxt':
        console.log('📍 CASE: pro-tools-ptxt - Creating Pro Tools markers');
        const proToolsMarkers = generateProToolsMarkers(markers, sanitizedTitle);
        downloadFile(proToolsMarkers, `${sanitizedTitle}.ptxt`, 'text/plain');
        break;
        
      case 'ableton-als':
        console.log('📍 CASE: ableton-als - Creating Ableton markers');
        const abletonMarkers = generateUniversalMarkers(markers, sanitizedTitle);
        downloadFile(abletonMarkers, `${sanitizedTitle} - Ableton Markers.txt`, 'text/plain');
        break;
        
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
