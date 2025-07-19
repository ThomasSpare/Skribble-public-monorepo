// frontend/src/lib/reaperExportEnhanced.ts
import { DAWMarker } from './audioUtils';

interface VoiceNoteTrack {
  id: string;
  timestamp: number;
  voiceNoteUrl: string;
  username: string;
  text: string;
  priority: string;
  duration?: number;
}

interface ReaperExportOptions {
  projectTitle: string;
  originalAudioFileName: string;
  sampleRate?: number;
  includeVoiceNotes?: boolean;
  userTier: string;
}

/**
 * Enhanced Reaper export that includes voice note tracks for Producer tier
 */
export async function generateEnhancedReaperProject(
  audioUrl: string,
  annotations: any[],
  options: ReaperExportOptions
): Promise<void> {
  const { 
    projectTitle, 
    originalAudioFileName, 
    sampleRate = 44100,
    includeVoiceNotes = false,
    userTier 
  } = options;

  console.log('🎛️ Generating enhanced Reaper project:', {
    projectTitle,
    originalAudioFileName,
    includeVoiceNotes,
    userTier,
    annotationCount: annotations.length
  });

  // Check if user has producer tier for voice note export
  const canExportVoiceNotes = ['producer', 'studio'].includes(userTier) && includeVoiceNotes;
  
  // Filter voice note annotations
  const voiceNoteAnnotations = canExportVoiceNotes 
    ? annotations.filter(a => a.voiceNoteUrl && !a.parentId)
    : [];

  // Generate markers from all annotations
  const markers = generateEnhancedDAWMarkers(annotations);
  
  // Create voice note tracks data
  const voiceNoteTracks: VoiceNoteTrack[] = voiceNoteAnnotations.map(annotation => ({
    id: annotation.id,
    timestamp: annotation.timestamp,
    voiceNoteUrl: annotation.voiceNoteUrl,
    username: annotation.user?.username || 'Unknown',
    text: annotation.text,
    priority: annotation.priority,
    duration: 10 // Default duration, will be updated if we can determine actual duration
  }));

  console.log('🎤 Voice note tracks to include:', voiceNoteTracks.length);

  // Extract file extension and create clean filename
  const audioExtension = originalAudioFileName.split('.').pop() || 'mp3';
  const cleanAudioFileName = `${projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '_')}.${audioExtension}`;

  // Generate Reaper project content
  const reaperProject = generateReaperProjectWithVoiceNotes(
    cleanAudioFileName,
    markers,
    voiceNoteTracks,
    projectTitle,
    sampleRate
  );

  // Create download package with actual audio file
  await createReaperDownloadPackage(
    reaperProject,
    projectTitle,
    voiceNoteTracks,
    canExportVoiceNotes,
    audioUrl,
    originalAudioFileName
  );
}

/**
 * Generate Reaper project file (.rpp) with voice note tracks
 */
function generateReaperProjectWithVoiceNotes(
  audioFileName: string,
  markers: DAWMarker[],
  voiceNoteTracks: VoiceNoteTrack[],
  projectTitle: string,
  sampleRate: number
): string {
  const now = Math.floor(Date.now() / 1000);
  
  // Calculate project length (last marker + 30 seconds buffer)
  const lastTimestamp = Math.max(
    ...markers.map(m => m.timestamp),
    ...voiceNoteTracks.map(v => v.timestamp),
    0
  );
  const projectLength = Math.ceil(lastTimestamp + 30);

  let rpp = `<REAPER_PROJECT 0.1 "7.0/linux-x86_64" ${now}
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
  MAXPROJLEN 0 ${projectLength}
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
  SAMPLERATE ${sampleRate} 0 0
  <RENDER_CFG
  >
  <METRONOME 6 2
    VOL 0.25 0.125
    FREQ 800 1600 1
    BEATLEN 4
    SAMPLES "" ""
    PATTERN 2863311530 2863311529
    MULT 1
  >
  <GLOBAL_AUTOMATION 
  >
  <MASTERHW 
  >
  <MASTERITEM
  >
  <MASTERMUTESOLO 0
  >
  <TEMPOMAP
    120.00000000 4 4
  >
`;

  // Add markers
  if (markers.length > 0) {
    rpp += '  <MARKERS>\n';
    markers.forEach((marker, index) => {
      const markerColor = getReaperMarkerColor(marker);
      rpp += `    MARKER ${index + 1} ${marker.timestamp.toFixed(6)} "${escapeReaperString(marker.label)}" 0 ${markerColor} 1 R {${marker.type === 'region' ? 'region' : 'marker'}}\n`;
    });
    rpp += '  >\n';
  }

  // Add main audio track
  rpp += `  <TRACK {${generateTrackGUID()}
    NAME "Main Audio"
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
    REC 0 0 1 0 0 0 0 0
    VU 2
    TRACKHEIGHT 0 0 0 0 0 0
    INQ 0 0 0 0.5 100 0 0 100
    NCHAN 2
    FX 1
    TRACKID {${generateTrackGUID()}}
    PERF 0
    MIDIOUT -1
    MAINSEND 1 0
    <ITEM
      POSITION 0
      SNAPOFFS 0
      LENGTH ${projectLength}
      LOOP 1
      ALLTAKES 0
      FADEIN 1 0 0 1 0 0 0
      FADEOUT 1 0 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {${generateItemGUID()}}
      IID 1
      NAME "${audioFileName}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {${generateItemGUID()}}
      <SOURCE WAVE
        FILE "${audioFileName}"
      >
    >
  >
`;

  // Add voice note tracks (only for producer tier)
  if (voiceNoteTracks.length > 0) {
    voiceNoteTracks.forEach((voiceNote, index) => {
      const trackColor = getPriorityColor(voiceNote.priority);
      const voiceFileName = `voice_note_${index + 1}_${voiceNote.username}.mp3`;
      
      rpp += `  <TRACK {${generateTrackGUID()}
    NAME "🎤 ${voiceNote.username} - ${voiceNote.text.substring(0, 30)}${voiceNote.text.length > 30 ? '...' : ''}"
    PEAKCOL ${trackColor}
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
    REC 0 0 1 0 0 0 0 0
    VU 2
    TRACKHEIGHT 0 0 0 0 0 0
    INQ 0 0 0 0.5 100 0 0 100
    NCHAN 2
    FX 1
    TRACKID {${generateTrackGUID()}}
    PERF 0
    MIDIOUT -1
    MAINSEND 1 0
    <ITEM
      POSITION ${voiceNote.timestamp.toFixed(6)}
      SNAPOFFS 0
      LENGTH ${voiceNote.duration || 10}
      LOOP 1
      ALLTAKES 0
      FADEIN 1 0 0 1 0 0 0
      FADEOUT 1 0 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {${generateItemGUID()}}
      IID ${index + 2}
      NAME "${voiceNote.username}: ${voiceNote.text}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {${generateItemGUID()}}
      <SOURCE WAVE
        FILE "${voiceFileName}"
      >
      <NOTES
        |Voice Note: ${voiceNote.text}
        |Priority: ${voiceNote.priority}
        |User: ${voiceNote.username}
        |Timestamp: ${formatTime(voiceNote.timestamp)}
        |
        |This voice note was recorded using Skribble.
        |Original URL: ${voiceNote.voiceNoteUrl}
      >
    >
  >
`;
    });
  }

  rpp += '>\n';
  return rpp;
}

/**
 * Create separate downloads for each file (no zip)
 */
async function createReaperDownloadPackage(
  reaperProject: string,
  projectTitle: string,
  voiceNoteTracks: VoiceNoteTrack[],
  includeVoiceNotes: boolean,
  audioUrl: string,
  originalFileName: string
): Promise<void> {
  const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
  
  // Extract file extension from original audio file
  const audioExtension = originalFileName.split('.').pop() || 'mp3';
  const cleanAudioFileName = `${sanitizedTitle}.${audioExtension}`;
  
  console.log('📦 Creating individual file downloads...');
  
  // 1. Download Reaper project file (.rpp)
  downloadTextFile(reaperProject, `${sanitizedTitle}.rpp`);
  
  // 2. Download instructions
  const instructions = generateInstructions(sanitizedTitle, includeVoiceNotes, cleanAudioFileName);
  downloadTextFile(instructions, `${sanitizedTitle}_README.txt`);
  
  // 3. Download main audio file (for producer tier and above)
  console.log('📥 Downloading main audio file...');
  await downloadAudioFile(audioUrl, cleanAudioFileName);
  
  // 4. Download voice note files if producer tier
  if (includeVoiceNotes && voiceNoteTracks.length > 0) {
    console.log('📥 Downloading voice note files...');
    
    for (let i = 0; i < voiceNoteTracks.length; i++) {
      const voiceNote = voiceNoteTracks[i];
      try {
        console.log(`📥 Downloading voice note ${i + 1}/${voiceNoteTracks.length}...`);
        
        const fileName = `voice_note_${i + 1}_${voiceNote.username}.mp3`;
        await downloadAudioFile(voiceNote.voiceNoteUrl, fileName);
        console.log(`✅ Downloaded: ${fileName}`);
        
        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error downloading voice note ${i + 1}:`, error);
      }
    }
  }
  
  console.log('✅ All Reaper project files downloaded successfully!');
  
  // Show user notification about file organization
  setTimeout(() => {
    alert(`📁 REAPER PROJECT EXPORTED!\n\nFiles downloaded:\n• ${sanitizedTitle}.rpp (Reaper project)\n• ${cleanAudioFileName} (main audio)\n${includeVoiceNotes && voiceNoteTracks.length > 0 ? `• ${voiceNoteTracks.length} voice note files\n` : ''}• README instructions\n\n💡 TIP: Create a folder called "${sanitizedTitle}" and move all files there before opening in Reaper.`);
  }, 1000);
}

/**
 * Download text file (RPP, instructions)
 */
function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download audio file with proper naming
 */
async function downloadAudioFile(audioUrl: string, filename: string): Promise<void> {
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(`Failed to download audio file ${filename}:`, error);
    throw error;
  }
}

/**
 * Generate enhanced DAW markers
 */
function generateEnhancedDAWMarkers(annotations: any[]): DAWMarker[] {
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
 * Format marker label for Reaper
 */
function formatMarkerLabel(annotation: any): string {
  const username = annotation.user?.username || 'Unknown';
  const typeIcon = getAnnotationTypeIcon(annotation.annotationType);
  const priorityIndicator = annotation.priority === 'critical' ? '🔥 ' : 
                           annotation.priority === 'high' ? '⚡ ' : '';
  
  let text = annotation.text.trim();
  if (text.length > 50) {
    text = text.substring(0, 47) + '...';
  }
  
  return `${priorityIndicator}${typeIcon} ${username}: ${text}`;
}

/**
 * Get annotation type icon
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
 * Get marker type for Reaper
 */
function getMarkerType(annotationType: string): 'cue' | 'marker' | 'region' {
  switch (annotationType) {
    case 'section': return 'region';
    case 'marker': return 'cue';
    default: return 'marker';
  }
}

/**
 * Get annotation color for Reaper markers
 */
function getAnnotationColor(annotation: any): string {
  // Priority-based colors
  if (annotation.priority === 'critical') return '#ff4444';
  if (annotation.priority === 'high') return '#ff8800';
  if (annotation.priority === 'medium') return '#ffcc00';
  if (annotation.priority === 'low') return '#44ff44';
  
  // Type-based colors
  switch (annotation.annotationType) {
    case 'issue': return '#ff6b6b';
    case 'approval': return '#51cf66';
    case 'voice': return '#9775fa';
    case 'section': return '#339af0';
    default: return '#74c0fc';
  }
}

/**
 * Get Reaper marker color code
 */
function getReaperMarkerColor(marker: DAWMarker): number {
  // Convert hex color to Reaper color format
  const hex = marker.color?.replace('#', '') || 'ffffff';
  return parseInt(hex, 16);
}

/**
 * Get priority-based track color for Reaper
 */
function getPriorityColor(priority: string): number {
  switch (priority) {
    case 'critical': return 16711680; // Red
    case 'high': return 16744448;     // Orange
    case 'medium': return 16776960;   // Yellow
    case 'low': return 65280;         // Green
    default: return 8421504;          // Gray
  }
}

/**
 * Generate unique GUID for Reaper tracks/items
 */
function generateTrackGUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }).toUpperCase();
}

/**
 * Generate unique GUID for Reaper items
 */
function generateItemGUID(): string {
  return generateTrackGUID();
}

/**
 * Escape string for Reaper project format
 */
function escapeReaperString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Format time for display
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Generate instruction file
 */
function generateInstructions(projectTitle: string, includeVoiceNotes: boolean, cleanAudioFileName: string): string {
  return `# Skribble Export - ${projectTitle}
Generated: ${new Date().toLocaleString()}

## QUICK START FOR REAPER:

1. **Create Project Folder:**
   - Create a new folder called "${projectTitle}"
   - Move ALL downloaded files into this folder

2. **Open in Reaper:**
   - Open Reaper
   - File > Open Project
   - Select ${projectTitle}.rpp
   - Everything will load automatically with correct positioning!

## WHAT'S INCLUDED:

✅ ${projectTitle}.rpp (Reaper project file)
✅ ${cleanAudioFileName} (your main audio file)
${includeVoiceNotes ? `✅ Voice note MP3 files (positioned automatically)` : `❌ Voice notes (upgrade to Producer tier for audio files)`}
✅ All annotation markers on timeline

${includeVoiceNotes ? `
## VOICE NOTES:
- Voice notes are automatically placed on separate tracks
- Each track shows the user name and comment
- Audio files are synced to exact timestamps
- No manual setup required!
` : `
## VOICE NOTES:
- Voice note markers are visible on timeline
- Audio files require Producer tier subscription
- Upgrade at skribble.app to export voice recordings
`}

## MARKER LEGEND:
🔥 = Critical Priority    ⚡ = High Priority
💬 = Comment             🎤 = Voice Note  
⚠️ = Issue              ✅ = Approval
📍 = Marker             🎵 = Section

## TIPS:
- All files must be in the same folder as the .rpp file
- Voice note tracks are color-coded by priority
- Use track solo/mute to focus on specific feedback
- Export your revised track when done!

---
Exported from Skribble - Music Collaboration Platform
Visit skribble.app for more features
`;
}
