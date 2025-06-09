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
  audioUrl: string, 
  markers: DAWMarker[], 
  filename: string
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
    
    console.log(`Generating WAV with ${markers.length} cue points for ${filename}`);
    
    // Return the original file for now - in production you'd embed the cue points
    return new Blob([arrayBuffer], { type: 'audio/wav' });
    
  } catch (error) {
    console.error('Error generating WAV with cues:', error);
    throw error;
  }
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
    return `MARKER ${Math.floor(marker.timestamp)} "${marker.label}" 0 ${colorInt} 1 B {${generateGUID()}}`;
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
      LENGTH ${Math.ceil(Math.max(...markers.map(m => m.timestamp)) + 10)}
      LOOP 1
      ALLTAKES 0
      FADEIN 1 0 0 1 0 0 0
      FADEOUT 1 0 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {${generateGUID()}}
      IID 1
      NAME "${audioFileName}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {${generateGUID()}}
      <SOURCE WAVE
        FILE "${audioFileName}"
      >
    >
  >
>`;

  return reaper;
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

/**
 * Main export function for DAW compatibility
 */
export async function exportForDAW(
  audioUrl: string,
  annotations: any[],
  projectTitle: string,
  audioFileName: string,
  format: DAWExportFormat = 'wav-cues'
) {
  const markers = generateEnhancedDAWMarkers(annotations);
  const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
  
  console.log(`Exporting ${markers.length} markers for ${sanitizedTitle} in ${format} format`);
  
  try {
    switch (format) {
      case 'wav-cues':
        // Import the WAV embedder for proper cue point embedding
        const { exportWAVWithEmbeddedAnnotations } = await import('./wavMetadataEmbedder');
        await exportWAVWithEmbeddedAnnotations(audioUrl, annotations, sanitizedTitle);
        break;
        
      case 'reaper-rpp':
        const reaperProject = generateEnhancedReaperProject(audioFileName, markers, sanitizedTitle, audioFileName);
        downloadFile(reaperProject, `${sanitizedTitle}.rpp`, 'text/plain');
        break;
        
      case 'logic-markers':
        const logicMarkers = generateLogicMarkers(markers, sanitizedTitle);
        downloadFile(logicMarkers, `${sanitizedTitle} - Logic Markers.txt`, 'text/plain');
        break;
        
      case 'pro-tools-ptxt':
        const proToolsMarkers = generateProToolsMarkers(markers, sanitizedTitle);
        downloadFile(proToolsMarkers, `${sanitizedTitle}.ptxt`, 'text/plain');
        break;
        
      case 'ableton-als':
        // Ableton Live Set format is complex - for now export universal markers
        const abletonMarkers = generateUniversalMarkers(markers, sanitizedTitle);
        downloadFile(abletonMarkers, `${sanitizedTitle} - Ableton Markers.txt`, 'text/plain');
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    return {
      success: true,
      message: `Exported ${markers.length} markers for ${format}`,
      markerCount: markers.length
    };
    
  } catch (error) {
    console.error('Export for DAW failed:', error);
    throw error;
  }
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