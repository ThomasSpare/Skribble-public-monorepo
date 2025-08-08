import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Clock, SkipBack, SkipForward, History, Volume2, X, Palette, RotateCcw, Sun, VolumeX, Loader2, AlertCircle, Sparkles, Check, ZoomIn, ZoomOut, Home, Grid, User } from 'lucide-react';
import AnnotationSystem from './AnnotationSystem';
import TempoGridControls from './TempoGridControls';
import VersionControl from './VersionControl';
import UserAvatar from './userAvatar';
import { DAWExportFormat, exportForDAW } from '../lib/audioUtils';
import CollaboratorsMenuPortal from './Portal';



interface WaveformPlayerProps {
  audioUrl: string;
  audioFileId: string;
  projectId: string;
  title?: string;
  isViewOnly?: boolean;
  initialAnnotations?: any[];
  waveformData?: number[];
  disableAnnotationFetching?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadComplete?: (duration: number) => void;
   onVersionChange?: (versionData: any) => void;
  currentUser?: {
    id: string;
    username: string;
    email: string;
  };
}

interface AnnotationType {
  id: string;
  audioFileId: string;
  userId: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    subscriptionTier: string;
    profileImage?: string;
    createdAt: string;
    updatedAt: string;
  };
  timestamp: number;
  text: string;
  voiceNoteUrl?: string;
  annotationType: 'comment' | 'marker' | 'voice' | 'section' | 'issue' | 'approval';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'resolved' | 'approved';
  parentId?: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

interface HoveredAnnotation {
  id: string;
  x: number;
  timestamp: number;
  text: string;
  user: string;
  type: string;
  priority: string; 
  status: string;
  createdAt: string;   
}

interface GradientShaderSettings {
  pattern: 'linear' | 'radial' | 'conic' | 'wave' | 'energy';
  intensity: number; // 1-3
  enabled: boolean;
}



export default function IntegratedWaveformPlayer({ 
  audioUrl, 
  audioFileId,
  projectId,
  isViewOnly = false,
  initialAnnotations = [],
  disableAnnotationFetching = false,
  title = "Audio Track",
  onTimeUpdate,
  onLoadComplete,
  onVersionChange,
  currentUser
}: WaveformPlayerProps) {
  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isGeneratingWaveform, setIsGeneratingWaveform] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [showDAWExportMenu, setShowDAWExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dawExportMenuRef = useRef<HTMLDivElement>(null);
  const [showVersionControl, setShowVersionControl] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<any>(null);
  const [audioUrlState, setAudioUrlState] = useState<string>(audioUrl);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cursor and playback state
  const [lastCursorPosition, setLastCursorPosition] = useState(0);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [shouldResumeFromCursor, setShouldResumeFromCursor] = useState(false);

  // Mouse drag state
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [mouseDragStart, setMouseDragStart] = useState({ x: 0, offset: 0 });
  const [dragButton, setDragButton] = useState<number>(0); // Track which button is pressed
  
  // Momentum scrolling state
  const [isInertiaScrolling, setIsInertiaScrolling] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const [lastMoveTime, setLastMoveTime] = useState(0);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [justCompletedDrag, setJustCompletedDrag] = useState(false);
  const inertiaAnimationRef = useRef<number | null>(null);

  // Annotation state
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Zoom and scroll state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, offset: 0 });

  // Enhanced annotation interaction state
  const [hoveredAnnotation, setHoveredAnnotation] = useState<HoveredAnnotation | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number, y: number } | null>({ x: 0, y: 0 });
  const [clickFeedback, setClickFeedback] = useState<{x: number, timestamp: number} | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  //Tiers
  const [userTierInfo, setUserTierInfo] = useState<any>(null);

// Grid and tap tempo state
  const [bpm, setBpm] = useState<number>(120);
  const [gridMode, setGridMode] = useState<'none' | 'beats' | 'bars'>('none');
  const [isTapTempoMode, setIsTapTempoMode] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [gridOffset, setGridOffset] = useState(0);

  // Tempo grid and beat detection state
  const [gridOffsetMs, setGridOffsetMs] = useState(0);
  const [detectedBeats, setDetectedBeats] = useState<number[]>([]);

  // Gradient shader settings
  const [gradientSettings, setGradientSettings] = useState<GradientShaderSettings>({
  pattern: 'linear',
  intensity: 2,
  enabled: true
});
const [showGradientMenu, setShowGradientMenu] = useState(false);


// DAW export options
  const DAW_EXPORT_OPTIONS = [
  { 
    value: 'wav-cues' as DAWExportFormat, 
    label: 'WAV + Cue Points', 
    description: 'Embeds annotations directly in audio file', 
    icon: '🎵',
    tierRequired: 'indie',
    detail: 'Annotations appear as markers when opened in any DAW'
  },
  { 
    value: 'reaper-rpp' as DAWExportFormat, 
    label: 'Reaper Project', 
    description: 'Complete RPP project file with markers', 
    icon: '🎛️',
    tierRequired: 'producer',
    detail: 'Ready-to-import Reaper project with timeline markers'
  },
  { 
    value: 'logic-markers' as DAWExportFormat, 
    label: 'Logic Pro Markers', 
    description: 'Logic marker import file', 
    icon: '🍎',
    tierRequired: 'producer',
    detail: 'Import directly into Logic Pro timeline'
  },
  { 
    value: 'pro-tools-ptxt' as DAWExportFormat, 
    label: 'Pro Tools Session', 
    description: 'Session markers (.ptxt)', 
    icon: '🔧',
    tierRequired: 'producer',
    detail: 'Pro Tools compatible session markers'
  },
  { 
    value: 'ableton-als' as DAWExportFormat, 
    label: 'Ableton Live', 
    description: 'Live set with locators', 
    icon: '🎚️',
    tierRequired: 'producer',
    detail: 'Ableton Live set with timeline locators'
  }
];

  const getVisibleAnnotations = useCallback(() => {
  if (!annotations.length) return [];
  
  const visibleDuration = duration / zoomLevel;
  const visibleStart = scrollOffset;
  const visibleEnd = scrollOffset + visibleDuration;
  
  return annotations
    .filter(annotation => 
      !annotation.parentId && // Only parent annotations
      annotation.timestamp >= visibleStart && 
      annotation.timestamp <= visibleEnd
    )
    .map(annotation => ({
      ...annotation,
      screenX: ((annotation.timestamp - visibleStart) / visibleDuration)
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}, [annotations, duration, zoomLevel, scrollOffset]);

  
  // Constants
  const CANVAS_HEIGHT = 200; // Increased from 120
  const GRID_COLORS = {
    beat: 'rgba(198, 216, 255, 0.1)',
    bar: 'rgba(198, 216, 255, 0.2)',
    subbeat: 'rgba(198, 216, 255, 0.05)'
  };
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 10;
  
  // Responsive annotation bubble sizing based on canvas dimensions
  const getAnnotationBubbleDimensions = () => {
    const container = waveformContainerRef.current;
    if (!container) return { width: 36, height: 32 }; // Default desktop sizes
    
    const containerWidth = container.clientWidth;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    
    if (isMobile) {
      // Scale bubbles based on the container width ratio
      // Desktop baseline: ~1200px container = 36px bubble
      // Mobile: ~750px+ container (200vw) should have proportionally sized bubbles
      const scaleFactor = Math.min(1, containerWidth / 1200);
      const baseWidth = 36;
      const baseHeight = 32;
      
      return {
        width: Math.max(18, Math.floor(baseWidth * scaleFactor * 0.7)), // 70% of scaled size, min 18px
        height: Math.max(16, Math.floor(baseHeight * scaleFactor * 0.7))  // 70% of scaled size, min 16px
      };
    }
    
    return { width: 36, height: 32 }; // Desktop sizes
  };
  
  // Note: Don't create constants here - use getAnnotationBubbleDimensions() directly for dynamic sizing

  // Enable audio on any user interaction
  useEffect(() => {
    const enableAudio = async () => {
      setUserInteracted(true);
      
      // Try to create and resume AudioContext immediately on user interaction
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
        } catch (error) {
          console.error('Failed to create/resume audio context:', error);
        }
      }
    };

    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, enableAudio, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, enableAudio);
      });
    };
  }, []);

  // Handle click outside to close DAW export menu
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dawExportMenuRef.current && !dawExportMenuRef.current.contains(event.target as Node)) {
          setShowDAWExportMenu(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

  // Initialize audio when URL changes
  useEffect(() => {
    if (audioUrl && userInteracted) {
      initializeAudio();
    }
    
    return () => {
      cleanup();
    };
  }, [audioUrl, userInteracted]);

  useEffect(() => {
  const fetchUserTierInfo = async () => {
    try {
      const token = localStorage.getItem('skribble_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/subscription`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Create tier info based on subscription
        setUserTierInfo({
          tier: data.data.tier || 'free',
          limits: {
            allowedExportFormats: getExportFormatsForTier(data.data.tier || 'free')
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch tier info:', error);
    }
  };

  fetchUserTierInfo();
}, []);

  // Cleanup momentum scrolling animation on unmount
  useEffect(() => {
    return () => {
      if (inertiaAnimationRef.current) {
        cancelAnimationFrame(inertiaAnimationRef.current);
      }
    };
  }, []);

const getExportFormatsForTier = (tier: string): DAWExportFormat[] => {
  const tierFormats: Record<string, DAWExportFormat[]> = {
    free: [], // No exports for free
    indie: ['wav-cues'], // Only WAV with cues for Indie
    producer: ['wav-cues', 'reaper-rpp', 'logic-markers', 'pro-tools-ptxt', 'ableton-als'], // All formats
    studio: ['wav-cues', 'reaper-rpp', 'logic-markers', 'pro-tools-ptxt', 'ableton-als'] // All formats
  };
  return tierFormats[tier] || [];
};


  useEffect(() => {
  if (disableAnnotationFetching) {
    return; // Skip fetching if disabled
  }

  async function fetchAnnotations() {
    try {      
      // For view-only mode, don't fetch annotations as they should come from initialAnnotations
      if (isViewOnly) {
        return;
      }

      const token = localStorage.getItem('skribble_token');
      if (!token) {
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/annotations/audio/${audioFileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAnnotations(data.data);
      } else {
        console.error('Failed to fetch annotations:', data.error);
      }
    } catch (error) {
      console.error('Error fetching annotations:', error);
    }
  }

  if (audioFileId) {
    fetchAnnotations();
  }
}, [audioFileId, isViewOnly, disableAnnotationFetching]);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  };

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (sourceRef.current && audioContextRef.current) {
      try {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      } catch (error) {
        console.warn('Error disconnecting audio source:', error);
      }
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
      } catch (error) {
        console.warn('Error closing audio context:', error);
      }
    }
  };
  
  
  const generateWaveform = async () => {
  if (!userInteracted) {
    return;
  }

  try {    
    // Create a new AudioContext specifically for waveform generation
    let tempAudioContext;
    try {
      tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume the context if needed
      if (tempAudioContext.state === 'suspended') {
        await tempAudioContext.resume();
      }
      
    } catch (contextError) {
      console.error('Failed to create temp AudioContext:', contextError);
      throw new Error('AudioContext creation failed');
    }
    
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer(); 
    const audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
    const actualDuration = audioBuffer.duration;
    setDuration(actualDuration);
    onLoadComplete?.(actualDuration);
    
    const channelData = audioBuffer.getChannelData(0);
    const samples = Math.floor(actualDuration * 50);
    const blockSize = Math.floor(channelData.length / samples);
    const waveform: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      const end = start + blockSize;
      let sum = 0;
      let count = 0;
      
      for (let j = start; j < end && j < channelData.length; j++) {
        sum += Math.abs(channelData[j]);
        count++;
      }
      
      if (count > 0) {
        waveform.push(sum / count);
      }
    }
    
    const max = Math.max(...waveform);
    const normalizedWaveform = max > 0 ? waveform.map(sample => sample / max) : waveform;
    
    setWaveformData(normalizedWaveform);
    await tempAudioContext.close();
    
  } catch (error) {
    console.error('Error generating waveform:', error);
    
    // Create a fallback waveform
    const fallbackDuration = audioRef.current?.duration || 180;
    const fallbackSamples = Math.floor(fallbackDuration * 50);
    const fallback = Array.from({ length: fallbackSamples }, () => Math.random() * 0.5 + 0.25);
    setWaveformData(fallback);
    setDuration(fallbackDuration);  }
};


  const setupWebAudio = async () => {
      if (!audioRef.current || sourceRef.current) return;

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const audioContext = audioContextRef.current;

        // Always try to resume the AudioContext after user interaction
        if (audioContext.state === 'suspended') {          
          await audioContext.resume();
        }
        
        // Only create the source if it doesn't exist
        if (!sourceRef.current) {
          sourceRef.current = audioContext.createMediaElementSource(audioRef.current);
          analyserRef.current = audioContext.createAnalyser();
          
          analyserRef.current.fftSize = 2048;
          analyserRef.current.smoothingTimeConstant = 0.8;
          
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContext.destination);         
        }
      } catch (error) {
        console.error('Web Audio API setup failed:', error);
        // Don't throw the error - let the audio work without Web Audio API
        console.warn('Continuing without Web Audio API features');
      }
    };
  // Initialize audio and generate waveform
  const initializeAudio = async (newAudioUrl: string = audioUrlState) => {
    // 🔑 CRITICAL: Validate URL before proceeding
    if (!newAudioUrl || !newAudioUrl.startsWith('http')) {
      console.error('❌ IntegratedWaveformPlayer: initializeAudio called with invalid URL:', newAudioUrl);
      setError('Invalid audio URL provided');
      setIsLoading(false);
      setIsGeneratingWaveform(false);
      return;
    }
    
    if (!audioRef.current) {
      console.error('Audio ref not available');
      return;
    }

    
    setIsLoading(true);
    setIsGeneratingWaveform(true);
    setError(null);
    setIsAudioReady(false);

    try {
      const audio = audioRef.current;
      
      // Clear any existing src first
      audio.src = '';
      audio.pause();
      audio.currentTime = 0;
      
      // Set CORS and preload settings
      audio.crossOrigin = "anonymous";
      audio.preload = "metadata";
      audio.volume = volume;
      audio.muted = isMuted;

      const audioLoadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio loading timeout after 15 seconds'));
        }, 15000);

        const onLoadedMetadata = () => {
          clearTimeout(timeout);      
          setDuration(audio.duration);
          onLoadComplete?.(audio.duration);
          resolve();
        };
        
        const onCanPlayThrough = () => {
          setIsAudioReady(true);
        };
        
        const onError = (e: Event) => {
          clearTimeout(timeout);
          console.error('Audio loading error:', audio.error, e);
          console.error('Audio error details:', {
            code: audio.error?.code,
            message: audio.error?.message,
            src: audio.src
          });
          reject(new Error(`Audio loading failed: ${audio.error?.message || 'MEDIA_ELEMENT_ERROR: Empty src attribute'}`));
        };
  
        const onLoadStart = () => {
          // Audio load started
        };
  
        const onProgress = () => {
          // Audio loading progress
        };
  
        audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
        audio.addEventListener('error', onError, { once: true });
        audio.addEventListener('loadstart', onLoadStart, { once: true });
        audio.addEventListener('progress', onProgress);
        
        // Cleanup function
        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', onLoadedMetadata);
          audio.removeEventListener('canplaythrough', onCanPlayThrough);
          audio.removeEventListener('error', onError);
          audio.removeEventListener('loadstart', onLoadStart);
          audio.removeEventListener('progress', onProgress);
        };
        
        // Store cleanup for later use
        (resolve as any).cleanup = cleanup;
        (reject as any).cleanup = cleanup;
      });
      audio.src = newAudioUrl;
      audio.load();

      await audioLoadPromise;
  
      // Try to setup Web Audio API (but don't fail if it doesn't work)
      try {
        await setupWebAudio();
      } catch (webAudioError) {
        console.warn('Web Audio API setup failed, but basic playback should still work:', webAudioError);
      }
  
      // Generate waveform
      try {
        await generateWaveform();
      } catch (waveformError) {
        console.warn('Waveform generation failed, but audio should still play:', waveformError);
      }   
    } catch (error) {
      console.error('Error initializing audio:', error);
      setError(`Failed to load audio: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
      setIsGeneratingWaveform(false);
    }
  };

  const handleAnnotationCreated = useCallback((newAnnotation: AnnotationType) => {
  setAnnotations(prev => [...prev, newAnnotation]);
  }, []);

  const handleAnnotationUpdated = useCallback((updatedAnnotation: AnnotationType) => {
    setAnnotations(prev => 
      prev.map(ann => ann.id === updatedAnnotation.id ? updatedAnnotation : ann)
    );
  }, []);

  const handleAnnotationDeleted = useCallback((annotationId: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
  }, []);

  // Calculate visible waveform based on zoom and scroll
  const getVisibleWaveform = useCallback(() => {
    if (waveformData.length === 0 || duration === 0) return [];
    
    const samplesPerSecond = waveformData.length / duration;
    const visibleDuration = duration / zoomLevel;
    const startTime = scrollOffset;
    const endTime = Math.min(startTime + visibleDuration, duration);
    
    const startIndex = Math.floor(startTime * samplesPerSecond);
    const endIndex = Math.min(Math.ceil(endTime * samplesPerSecond), waveformData.length);
    
    // Add resampling for smoother zoomed view
    const samples = waveformData.slice(startIndex, endIndex);
    const targetSamples = Math.floor(800 * (zoomLevel / 1))

    if (samples.length > targetSamples) {
    const skipCount = Math.floor(samples.length / targetSamples);
    return samples.filter((_, i) => i % skipCount === 0);
  }
    return samples;
  }, [waveformData, duration, zoomLevel, scrollOffset]);

  // Calculate time markers for the ruler with mobile optimization
  const getTimeMarkers = useCallback(() => {
    const visibleDuration = duration / zoomLevel;
    const startTime = scrollOffset;
    const endTime = startTime + visibleDuration;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    
    let interval: number;
    if (visibleDuration <= 10) {
      interval = isMobile ? 1 : 0.5; // Less cluttered on mobile
    } else if (visibleDuration <= 30) {
      interval = isMobile ? 2 : 1;
    } else if (visibleDuration <= 60) {
      interval = isMobile ? 10 : 5;
    } else if (visibleDuration <= 300) {
      interval = isMobile ? 20 : 10;
    } else if (visibleDuration <= 600) {
      interval = isMobile ? 60 : 30;
    } else {
      interval = isMobile ? 120 : 60;
    }
    
    const markers = [];
    const firstMarker = Math.ceil(startTime / interval) * interval;
    
    for (let time = firstMarker; time <= endTime; time += interval) {
      if (time >= 0 && time <= duration) {
        const position = ((time - startTime) / visibleDuration) * 100;
        markers.push({
          time,
          position,
          isMajor: time % (interval * 2) === 0 || interval >= 30
        });
      }
    }
    
    return markers;
  }, [duration, zoomLevel, scrollOffset]);


  const handleVersionError = useCallback((message: string) => {
    setErrorMessage(message);
    console.error('Version control error:', message);
    // Clear error after 5 seconds
    setTimeout(() => setErrorMessage(null), 5000);
  }, []);



  // Format time for display
  const formatRulerTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const decimals = Math.floor((seconds % 1) * 10);
    
    if (seconds < 60 && duration / zoomLevel <= 30) {
      return `${remainingSeconds}.${decimals}s`;
    } else if (seconds < 60) {
      return `${remainingSeconds}s`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  const handleMouseLeave = useCallback(() => {
    setHoveredAnnotation(null);
    setMousePosition(null);
    setClickFeedback(null);
  }, []);

  const seekTo = useCallback((time: number) => {
    if (!audioRef.current || !isAudioReady) return;
    
    // Don't seek during momentum scrolling to prevent cursor jumping
    if (isInertiaScrolling) {
      return;
    }
    
    const audio = audioRef.current;
    const clampedTime = Math.max(0, Math.min(time, duration));
    audio.currentTime = clampedTime;
    
    // Update last cursor position for Tab functionality (manual seeking)
    setLastCursorPosition(clampedTime);
  }, [duration, isAudioReady, isInertiaScrolling]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get annotation color based on type and priority
  const getAnnotationColor = (annotation: AnnotationType): string => {
    if (annotation.annotationType === 'issue') return '#ef4444';
    if (annotation.annotationType === 'approval') return '#22c55e';
    if (annotation.annotationType === 'marker') return '#f59e0b';
    if (annotation.annotationType === 'voice') return '#8b5cf6';
    if (annotation.annotationType === 'section') return '#06b6d4';
    
    switch (annotation.priority) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#71A9F7';
    }
  };

  // Enhanced tooltip positioning
  const getTooltipPosition = (hoveredAnnotation: HoveredAnnotation) => {
    if (!canvasRef.current) return { left: 0, top: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const tooltipWidth = 200;
    
    const left = Math.min(
      Math.max(hoveredAnnotation.x - tooltipWidth / 2, 10), 
      rect.width - tooltipWidth - 10
    );
    
    return {
      left,
      top: getAnnotationBubbleDimensions().height + 15
    };
  };

  const calculateGridSpacing = (ctx: CanvasRenderingContext2D, width: number, visibleDuration: number) => {
  const beatsPerSecond = bpm / 60;
  const pixelsPerSecond = width / visibleDuration;
  const pixelsPerBeat = pixelsPerSecond / beatsPerSecond;
  const pixelsPerBar = pixelsPerBeat * 4; // Assuming 4/4 time signature
  
  return {
    beat: pixelsPerBeat,
    bar: pixelsPerBar,
    subbeat: pixelsPerBeat / 4
  };
};

const getBeatAtTime = (time: number) => {
  const beatsPerSecond = bpm / 60;
  return time * beatsPerSecond;
};

const getTimeAtBeat = (beat: number) => {
  const secondsPerBeat = 60 / bpm;
  return beat * secondsPerBeat;
};

  // Draw grid lines
  const drawGridEnhanced = (ctx: CanvasRenderingContext2D, width: number, height: number, visibleDuration: number) => {
    if (gridMode === 'none') return;
    
    const gridSpacing = calculateGridSpacing(ctx, width, visibleDuration);
    const offsetSeconds = gridOffsetMs / 1000;
    const visibleStartBeat = getBeatAtTime(scrollOffset - offsetSeconds);
    
    ctx.save();
    
    // Draw sub-beats if zoomed in enough
    if (gridSpacing.beat > 40 && gridMode === 'beats') {
      ctx.strokeStyle = GRID_COLORS.subbeat;
      ctx.lineWidth = 1;
      
      for (let i = Math.floor(visibleStartBeat * 4); i < Math.ceil((visibleStartBeat + visibleDuration) * 4); i++) {
        const beatTime = getTimeAtBeat(i / 4) + offsetSeconds;
        const x = (beatTime - scrollOffset) * (width / visibleDuration);
        if (x >= 0 && x <= width) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
    }
    
    // Draw beat lines
    if (gridMode === 'beats' || gridMode === 'bars') {
      ctx.strokeStyle = GRID_COLORS.beat;
      ctx.lineWidth = 1;
      
      for (let i = Math.floor(visibleStartBeat); i < Math.ceil(visibleStartBeat + visibleDuration * (bpm / 60)); i++) {
        const beatTime = getTimeAtBeat(i) + offsetSeconds;
        const x = (beatTime - scrollOffset) * (width / visibleDuration);
        if (x >= 0 && x <= width) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
    }
    
    // Draw bar lines
    if (gridMode === 'bars') {
      ctx.strokeStyle = GRID_COLORS.bar;
      ctx.lineWidth = 2;
      
      const beatsPerBar = 4;
      for (let i = Math.floor(visibleStartBeat / beatsPerBar); i < Math.ceil((visibleStartBeat + visibleDuration * (bpm / 60)) / beatsPerBar); i++) {
        const beatTime = getTimeAtBeat(i * beatsPerBar) + offsetSeconds;
        const x = (beatTime - scrollOffset) * (width / visibleDuration);
        if (x >= 0 && x <= width) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
    }
    
    // Draw detected beats as faint markers
    if (detectedBeats.length > 0) {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)'; // green for detected beats
      ctx.lineWidth = 1;
      
      detectedBeats.forEach(beatTime => {
        const x = (beatTime - scrollOffset) * (width / visibleDuration);
        if (x >= 0 && x <= width) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      });
    }
    
    ctx.restore();
  };

const handleTapTempo = () => {
  const now = Date.now();
  
  // Clear old taps after 2 seconds
  const recentTaps = [...tapTimes.filter(time => now - time < 2000), now];
  setTapTimes(recentTaps);
  
  if (recentTaps.length > 1) {
    const intervals = [];
    for (let i = 1; i < recentTaps.length; i++) {
      intervals.push(recentTaps[i] - recentTaps[i - 1]);
    }
    
    const averageInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const newBpm = Math.round(60000 / averageInterval);
    
    if (newBpm >= 30 && newBpm <= 300) {
      setBpm(newBpm);
    }
  }
};


const alignGridToCursor = () => {
  const beatsPerSecond = bpm / 60;
  const currentBeat = currentTime * beatsPerSecond;
  const beatOffset = currentBeat % 1;
  setGridOffset(beatOffset);
};

const cycleGridMode = () => {
  setGridMode(current => {
    switch (current) {
      case 'none': return 'beats';
      case 'beats': return 'bars';
      case 'bars': return 'none';
      default: return 'none';
    }
  });
};

  // Enhanced annotation drawing functions
  const drawAnnotations = useCallback((
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number
) => {
  const visibleAnnotations = getVisibleAnnotations();
  
  visibleAnnotations.forEach(annotation => {
    const x = annotation.screenX * width;
    const isHovered = hoveredAnnotation?.id === annotation.id;
    
    drawAnnotationLine(ctx, x, height, annotation, isHovered);
    drawChatBubble(ctx, x, annotation, isHovered);
  });
}, [getVisibleAnnotations, hoveredAnnotation]);

  const drawAnnotationLine = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    height: number, 
    annotation: AnnotationType, 
    isHovered: boolean
  ) => {
    // Get responsive dimensions
    const bubbleDimensions = getAnnotationBubbleDimensions();
    const bubbleHeight = bubbleDimensions.height;
    
    const lineColor = getAnnotationColor(annotation);
    const lineWidth = isHovered ? 3 : 2;
    const alpha = isHovered ? 0.9 : 0.6;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, bubbleHeight + 8);
    ctx.lineTo(x, height - 5);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (isHovered) {
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, bubbleHeight + 8);
      ctx.lineTo(x, height - 5);
      ctx.stroke();
    }
    
    ctx.restore();
  };

  const drawChatBubble = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    annotation: AnnotationType, 
    isHovered: boolean
  ) => {
    // Get responsive dimensions
    const bubbleDimensions = getAnnotationBubbleDimensions();
    const bubbleWidth = bubbleDimensions.width;
    const bubbleHeight = bubbleDimensions.height;
    
    const bubbleX = x - bubbleWidth / 2;
    const bubbleY = 5;
    const bubbleColor = getAnnotationColor(annotation);
    const scale = isHovered ? 1.1 : 1;
    
    ctx.save();
    
    if (isHovered) {
      ctx.translate(x, bubbleY + bubbleHeight / 2);
      ctx.scale(scale, scale);
      ctx.translate(-x, -(bubbleY + bubbleHeight / 2));
    }
    
    ctx.fillStyle = bubbleColor;
    ctx.shadowColor = isHovered ? bubbleColor : 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = isHovered ? 12 : 6;
    ctx.shadowOffsetY = 2;
    
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight - 6, 8);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x - 6, bubbleY + bubbleHeight - 6);
    ctx.lineTo(x, bubbleY + bubbleHeight + 2);
    ctx.lineTo(x + 6, bubbleY + bubbleHeight - 6);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    drawAnnotationIcon(ctx, x, bubbleY + 4, annotation.annotationType, isHovered);
    drawPriorityIndicator(ctx, bubbleX + bubbleWidth - 8, bubbleY + 4, annotation.priority);
    
    ctx.restore();
  };

  const drawAnnotationIcon = (
    ctx: CanvasRenderingContext2D, 
    centerX: number, 
    centerY: number, 
    type: string, 
    isHovered: boolean
  ) => {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    const iconSize = isHovered ? 14 : 12;
    const halfSize = iconSize / 2;
    
    ctx.save();
    ctx.translate(centerX, centerY + 10);
    
    switch (type) {
      case 'comment':
        const dotSize = 2;
        const dotSpacing = 4;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc((i - 1) * dotSpacing, 0, dotSize, 0, 2 * Math.PI);
          ctx.fill();
        }
        break;
        
      case 'issue':
        ctx.fillRect(-1, -halfSize, 2, iconSize - 4);
        ctx.beginPath();
        ctx.arc(0, halfSize - 2, 1.5, 0, 2 * Math.PI);
        ctx.fill();
        break;
        
      case 'marker':
        ctx.beginPath();
        ctx.moveTo(-halfSize, -halfSize);
        ctx.lineTo(halfSize - 2, -halfSize + 3);
        ctx.lineTo(-halfSize, -halfSize + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-halfSize, -halfSize, 1, iconSize);
        break;
        
      case 'approval':
        ctx.beginPath();
        ctx.moveTo(-halfSize + 2, 0);
        ctx.lineTo(-2, halfSize - 2);
        ctx.lineTo(halfSize - 2, -halfSize + 2);
        ctx.stroke();
        break;
        
      case 'section':
        ctx.beginPath();
        ctx.moveTo(-halfSize + 2, -halfSize);
        ctx.lineTo(-halfSize, -halfSize);
        ctx.lineTo(-halfSize, halfSize);
        ctx.lineTo(-halfSize + 2, halfSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(halfSize - 2, -halfSize);
        ctx.lineTo(halfSize, -halfSize);
        ctx.lineTo(halfSize, halfSize);
        ctx.lineTo(halfSize - 2, halfSize);
        ctx.stroke();
        break;
        
      case 'voice':
        ctx.beginPath();
        ctx.ellipse(0, -2, 3, 5, 0, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.lineTo(0, halfSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-3, halfSize);
        ctx.lineTo(3, halfSize);
        ctx.stroke();
        break;
        
      default:
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc((i - 1) * 3, 0, 1, 0, 2 * Math.PI);
          ctx.fill();
        }
    }
    
    ctx.restore();
  };

  const drawPriorityIndicator = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    priority: string
  ) => {
    const colors = {
      'critical': '#ef4444',
      'high': '#f59e0b',
      'medium': '#eab308',
      'low': '#22c55e'
    };
    
    const color = colors[priority as keyof typeof colors] || colors.medium;
    ctx.fillStyle = color;
    
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x, y + (i * 3), 1, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  // Main waveform drawing function with click feedback
  // Replace or update the existing drawWaveform function:

  
const drawWaveform = useCallback(() => {
  const canvas = canvasRef.current;
  if (!canvas || waveformData.length === 0) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // Update canvas size to match container with pixel ratio for crisp rendering
  const container = waveformContainerRef.current;
  if (container) {
    const pixelRatio = window.devicePixelRatio || 1;
    const containerWidth = container.clientWidth;
    const containerHeight = CANVAS_HEIGHT;
    
    // Set internal canvas size (accounting for pixel ratio)
    canvas.width = containerWidth * pixelRatio;
    canvas.height = containerHeight * pixelRatio;
    
    // Set display size (CSS size)
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';
    
    // Scale context for crisp rendering
    ctx.scale(pixelRatio, pixelRatio);
  }

  const { width, height } = canvas;
  const displayWidth = canvas.style.width ? parseInt(canvas.style.width) : width;
  const displayHeight = canvas.style.height ? parseInt(canvas.style.height) : height;
  const visibleWaveform = getVisibleWaveform();
  const visibleDuration = duration / zoomLevel;
  const progress = duration > 0 ? (currentTime - scrollOffset) / visibleDuration : 0;
  
  // Clear canvas with background
  ctx.clearRect(0, 0, displayWidth, displayHeight);
  
  // Draw grid first (if enabled)
  if (gridMode !== 'none') {
    drawGridEnhanced(ctx, displayWidth, displayHeight, visibleDuration);
  }
  
  // Draw waveform with performance optimization
  if (visibleWaveform.length > 0) {
    const barWidth = displayWidth / visibleWaveform.length;
    const centerY = displayHeight / 2;
    
    // Create paths for batch rendering
    const backgroundPath = new Path2D();
    const progressPath = new Path2D();
    
    visibleWaveform.forEach((sample, i) => {
      const barHeight = sample * displayHeight * 0.7;
      const x = i * barWidth;
      const y = centerY - barHeight / 2;
      const w = Math.max(1, barWidth - 1);
      
      if (i < Math.floor(visibleWaveform.length * progress)) {
        progressPath.rect(x, y, w, barHeight);
      } else {
        backgroundPath.rect(x, y, w, barHeight);
      }
    });
    
    // Batch render background waveform
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
    backgroundGradient.addColorStop(0, '#ff9e00');    // orange-peel
    backgroundGradient.addColorStop(0.5, '#ff8500');  // ut-orange  
    backgroundGradient.addColorStop(1, '#ff7900');    // safety-orange

    ctx.fillStyle = backgroundGradient;
    ctx.fill(backgroundPath);

    // Batch render progress waveform (brighter orange gradient)
    if (progress > 0) {
      const progressGradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
      progressGradient.addColorStop(0, '#ff6d00');    // pumpkin (brightest)
      progressGradient.addColorStop(0.5, '#ff7900');  // safety-orange
      progressGradient.addColorStop(1, '#ff9100');    // princeton-orange
      
      ctx.fillStyle = progressGradient;
      ctx.fill(progressPath);
    }
  }
  
  // Draw playhead
  if (currentTime >= scrollOffset && currentTime <= scrollOffset + visibleDuration) {
    const playheadX = ((currentTime - scrollOffset) / visibleDuration) * displayWidth;
    
    ctx.strokeStyle = '#ff6d00';  // pumpkin orange
    ctx.lineWidth = 3;  // Make it slightly thicker
    ctx.shadowColor = '#ff6d00';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, displayHeight);
    ctx.stroke();

    ctx.fillStyle = '#ff6d00';  // pumpkin orange
    ctx.shadowColor = '#ff6d00';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(playheadX, displayHeight - 10, 5, 0, Math.PI * 2);  // Slightly larger
    ctx.fill();

    // Reset shadow for other elements
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
  
  // Draw annotations on top
  drawAnnotations(ctx, displayWidth, displayHeight);
  
}, [waveformData, currentTime, duration, zoomLevel, scrollOffset, gridMode, bpm, gridOffset]);

  // Watch for container size changes and redraw for responsive sizing
  useEffect(() => {
    const container = waveformContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      // Force redraw when container size changes (for responsive annotation bubbles)
      requestAnimationFrame(() => {
        drawWaveform();
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [drawWaveform]);

  // Momentum scrolling implementation
  const startInertiaScroll = useCallback((initialVelocity: number) => {
    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
    }
    
    setIsInertiaScrolling(true);
    setVelocity(initialVelocity);
    
    const animate = () => {
      setVelocity(prevVelocity => {
        const newVelocity = prevVelocity * 0.95; // Deceleration factor
        
        if (Math.abs(newVelocity) < 0.1) {
          setIsInertiaScrolling(false);
          return 0;
        }
        
        // Apply the velocity to scroll offset
        setScrollOffset(prevOffset => {
          const visibleDuration = duration / zoomLevel;
          const newOffset = Math.max(0, Math.min(
            duration - visibleDuration,
            prevOffset - newVelocity
          ));
          return newOffset;
        });
        
        inertiaAnimationRef.current = requestAnimationFrame(animate);
        return newVelocity;
      });
    };
    
    inertiaAnimationRef.current = requestAnimationFrame(animate);
  }, [duration, zoomLevel]);

  // Enhanced mouse tracking for hover effects (FIXED)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setMousePosition({ x: mouseX, y: mouseY });

    // Handle drag scrolling for right-click
    if (isMouseDragging && dragButton === 2 && mouseDragStart) {
      // Calculate velocity for momentum scrolling
      const currentTime = Date.now();
      const deltaX = mouseX - mouseDragStart.x;
      const deltaXFromLast = mouseX - lastMouseX;
      const deltaTime = currentTime - lastMoveTime;
      
      if (deltaTime > 0) {
        const visibleDuration = duration / zoomLevel;
        const timePerPixel = visibleDuration / rect.width;
        const velocityPixelsPerMs = deltaXFromLast / Math.max(deltaTime, 1);
        const currentVelocity = velocityPixelsPerMs * timePerPixel * 16; // Convert to units per frame
        setVelocity(currentVelocity);
      }
      
      setLastMouseX(mouseX);
      setLastMoveTime(currentTime);
      
      const visibleDuration = duration / zoomLevel;
      const timePerPixel = visibleDuration / rect.width;
      const deltaTimeTotal = deltaX * timePerPixel;
      
      // Update scroll offset for smooth panning
      const newScrollOffset = Math.max(0, Math.min(
        duration - visibleDuration,
        mouseDragStart.offset - deltaTimeTotal
      ));
      
      setScrollOffset(newScrollOffset);
      return; // Don't check for annotation hovers while dragging
    }

    // Only check for annotation hovers if not dragging
    if (!isMouseDragging) {
      const visibleAnnotations = getVisibleAnnotations();
      let foundHover: HoveredAnnotation | null = null;

      for (const annotation of visibleAnnotations) {
        const x = annotation.screenX * rect.width;
        const bubbleDimensions = getAnnotationBubbleDimensions();
        const bubbleX = x - bubbleDimensions.width / 2;
        const bubbleY = 5;
        
        const isOverBubble = mouseX >= bubbleX && 
                            mouseX <= bubbleX + bubbleDimensions.width && 
                            mouseY >= bubbleY && 
                            mouseY <= bubbleY + bubbleDimensions.height;
        
        const isOverLine = mouseX >= x - 4 && 
                          mouseX <= x + 4 && 
                          mouseY >= bubbleY + bubbleDimensions.height;

        if (isOverBubble || isOverLine) {
          foundHover = {
            id: annotation.id,
            x: x,
            timestamp: annotation.timestamp,
            text: annotation.text,
            user: annotation.user?.username || 'Unknown User',
            type: annotation.annotationType,
            priority: annotation.priority,
            status: annotation.status,
            createdAt: annotation.createdAt
          };
          break;
        }
      }

      setHoveredAnnotation(foundHover);
    }
  }, [isMouseDragging, dragButton, mouseDragStart, duration, zoomLevel, getVisibleAnnotations, lastMouseX, lastMoveTime]);

const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const canvas = canvasRef.current;
  if (!canvas || !isAudioReady) return;
  
  // Only handle right-click (button 2) for dragging
  if (e.button === 2) {
    e.preventDefault(); // Prevent context menu
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Stop any ongoing inertia scrolling
    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }
    setIsInertiaScrolling(false);
    
    setIsMouseDragging(true);
    setMouseDragStart({ x: mouseX, offset: scrollOffset });
    setDragButton(2);
    setLastMouseX(mouseX);
    setLastMoveTime(Date.now());
    setVelocity(0);
    
    // Change cursor to grabbing
    canvas.style.cursor = 'grabbing';
  }
}, [isAudioReady, scrollOffset]);

const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const canvas = canvasRef.current;
  if (!canvas || !isAudioReady) return;

  // Handle right-click drag end
  if (isMouseDragging && dragButton === 2) {
    // If it was a very small movement, treat it as a seek (optional)
    const mouseThreshold = 5; // pixels
    const totalMovement = mouseDragStart ? Math.abs(e.clientX - (canvas.getBoundingClientRect().left + mouseDragStart.x)) : 0;
    
    if (totalMovement < mouseThreshold) {
      // Small movement - just end the drag without momentum
      setVelocity(0);
    } else {
      // Start momentum scrolling if there's sufficient velocity
      if (Math.abs(velocity) > 0.5) {
        startInertiaScroll(velocity);
      }
    }
    
    setIsMouseDragging(false);
    setMouseDragStart({ x: 0, offset: 0 });
    setDragButton(0);
    
    // Set flag to ignore the next click event (prevents phantom click after drag)
    setJustCompletedDrag(true);
    setTimeout(() => setJustCompletedDrag(false), 10); // Clear after 10ms
    
    // Reset cursor
    canvas.style.cursor = hoveredAnnotation ? 'pointer' : 'crosshair';
  }
}, [isMouseDragging, dragButton, mouseDragStart, isAudioReady, hoveredAnnotation, velocity, startInertiaScroll]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
  e.preventDefault();
  
  if (!canvasRef.current) return;
  
  // Stop momentum scrolling when user starts zooming
  if (isInertiaScrolling) {
    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }
    setIsInertiaScrolling(false);
    setVelocity(0);
  }
  
  const rect = canvasRef.current.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseProgress = mouseX / rect.width;
  
  const visibleDuration = duration / zoomLevel;
  const timeUnderMouse = scrollOffset + (mouseProgress * visibleDuration);
  
  const zoomFactor = e.deltaY > 0 ? 1 / 1.2 : 1.2;
  const newZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * zoomFactor));
  
  if (newZoomLevel !== zoomLevel) {
    const newVisibleDuration = duration / newZoomLevel;
    const newScrollOffset = Math.max(0, Math.min(
      duration - newVisibleDuration,
      timeUnderMouse - (mouseProgress * newVisibleDuration)
    ));
    
    // Update both zoom level and scroll offset at the same time
    setZoomLevel(newZoomLevel);
    setScrollOffset(newScrollOffset);
    
    // Force redraw
    requestAnimationFrame(() => {
      drawWaveform();
    });
  }
}, [zoomLevel, scrollOffset, duration, drawWaveform]);

  // Playback controls
  const togglePlayPause = async () => {
  if (!audioRef.current || !isAudioReady) {
    return;
  }

  const audio = audioRef.current;

  try {
    // Ensure audio context is running
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      // PAUSE: Remember we paused by user action
      audio.pause();
      setPausedByUser(true);
    } else {
      // PLAY: Check if we should resume from cursor position
      if (shouldResumeFromCursor && Math.abs(lastCursorPosition - audio.currentTime) > 0.1) {
        audio.currentTime = lastCursorPosition;
        setShouldResumeFromCursor(false);
      } else if (pausedByUser) {
        // Resume from current pause position
      }

      // Ensure audio is loaded and ready
      if (audio.readyState >= 2) {
        await audio.play();
        setPausedByUser(false);
      } else {
        audio.load();
        await new Promise((resolve) => {
          audio.addEventListener('canplay', resolve, { once: true });
        });
        await audio.play();
        setPausedByUser(false);
      }
    }
  } catch (error) {
    console.error('Error toggling playback:', error);
    setError(`Playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

  const skipBackward = () => seekTo(currentTime - 10);
  const skipForward = () => seekTo(currentTime + 10);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const controlsSection = (
  <div className="flex items-center gap-2 ml-4 border-l border-skribble-azure/20 pl-4">
    {/* Grid Mode Control */}
    <button
      onClick={cycleGridMode}
      className={`p-2 rounded-lg transition-colors ${
        gridMode !== 'none'
          ? 'bg-skribble-azure/20 text-skribble-azure'
          : 'text-skribble-azure/60 hover:text-skribble-azure'
      }`}
      title="Toggle Grid Mode"
    >
      <Grid className="w-4 h-4" />
    </button>

    {/* Tap Tempo Controls */}
    <div className="flex items-center gap-2">
      <button
        onClick={handleTapTempo}
        className={`px-3 py-1 rounded-lg text-sm transition-colors ${
          isTapTempoMode
            ? 'bg-skribble-azure text-white'
            : 'text-skribble-azure hover:bg-skribble-azure/20'
        }`}
      >
        Tap ({bpm} BPM)
      </button>
      
      <button
        onClick={alignGridToCursor}
        className="p-2 text-skribble-azure/60 hover:text-skribble-azure transition-colors"
        title="Align Grid to Cursor"
      >
        <Clock className="w-4 h-4" />
      </button>
    </div>
  </div>
);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  // Zoom controls
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(MAX_ZOOM, prev * 1.5));
  };

  const zoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(MIN_ZOOM, prev / 1.5);
      const visibleDuration = duration / prev;
      const newVisibleDuration = duration / newZoom;
      const centerTime = scrollOffset + visibleDuration / 2;
      const newOffset = Math.max(0, Math.min(duration - newVisibleDuration, centerTime - newVisibleDuration / 2));
      setScrollOffset(newOffset);
      return newZoom;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setScrollOffset(0);
  };

// Set up persistent audio event listeners
useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;
  


  const handleDurationChange = () => {
    setDuration(audio.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  // 🔑 FIXED: Simple play handler that just updates state
  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handleError = (e: Event) => {
    console.error('Audio error:', audio.error, e);
    setError(`Playback error: ${audio.error?.message || 'Unknown error'}`);
    setIsPlaying(false);
  };

  const handleLoadedMetadata = () => {
    setDuration(audio.duration);
    setIsAudioReady(true);
  };

  const handleCanPlayThrough = () => {
    setIsAudioReady(true);
  };

  // Add all event listeners
  audio.addEventListener('timeupdate', handleTimeUpdate);
  audio.addEventListener('durationchange', handleDurationChange);
  audio.addEventListener('ended', handleEnded);
  audio.addEventListener('pause', handlePause);
  audio.addEventListener('play', handlePlay);
  audio.addEventListener('error', handleError);
  audio.addEventListener('loadedmetadata', handleLoadedMetadata);
  audio.addEventListener('canplaythrough', handleCanPlayThrough);
  
  return () => {
    audio.removeEventListener('timeupdate', handleTimeUpdate);
    audio.removeEventListener('durationchange', handleDurationChange);
    audio.removeEventListener('ended', handleEnded);
    audio.removeEventListener('pause', handlePause);
    audio.removeEventListener('play', handlePlay);
    audio.removeEventListener('error', handleError);
    audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    audio.removeEventListener('canplaythrough', handleCanPlayThrough);
  };
}, [onTimeUpdate]);

  useEffect(() => {
  // Only update if we have a valid URL and it's different from current state
  if (audioUrl && audioUrl !== audioUrlState && audioUrl.startsWith('http')) {
    setAudioUrlState(audioUrl);
      
      // Re-initialize audio with the new URL
      if (userInteracted) {
        initializeAudio(audioUrl);
      }
    }
  }, [audioUrl, audioUrlState]);

  useEffect(() => {    
    if (audioUrl && audioUrl.startsWith('http')) {
      setAudioUrlState(audioUrl);
      // Audio will be initialized on first user interaction
    } else {
    }
  }, []);


useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Check if user is typing in an input field
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      (activeElement as HTMLElement).contentEditable === 'true' ||
      activeElement.getAttribute('role') === 'textbox'
    );

    if (isInputFocused) {
      return;
    }

    // Handle Space key - Play/Pause toggle
    if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      
      // Use current values to check readiness
      const currentAudioRef = audioRef.current;
      const currentIsAudioReady = isAudioReady;
      const currentUserInteracted = userInteracted;
      const currentAudioUrl = audioUrlState;
      
      // Handle user interaction
      if (!currentUserInteracted) {
        setUserInteracted(true);
        if (currentAudioUrl && currentAudioUrl.startsWith('http')) {
          initializeAudio(currentAudioUrl);
        }
        return;
      }

      if (!currentAudioRef || !currentIsAudioReady) {
        return;
      }

      // Use the proper toggle function to maintain state sync
      togglePlayPause().catch(() => {});
    }

    // Handle Tab key - Play from last cursor position
    if (e.code === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      
      const currentAudioRef = audioRef.current;
      const currentIsAudioReady = isAudioReady;
      const currentUserInteracted = userInteracted;
      const currentAudioUrl = audioUrlState;
      
      // Handle user interaction
      if (!currentUserInteracted) {
        setUserInteracted(true);
        if (currentAudioUrl && currentAudioUrl.startsWith('http')) {
          initializeAudio(currentAudioUrl);
        }
        return;
      }

      if (!currentAudioRef || !currentIsAudioReady) {
        return;
      }

      // Seek to last cursor position and start playing
      seekTo(lastCursorPosition);
      if (currentAudioRef.paused) {
        togglePlayPause().catch(() => {});
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}, [togglePlayPause, seekTo, lastCursorPosition]);

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        drawWaveform();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      drawWaveform();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawWaveform, isPlaying]);

  // Click feedback animation
  useEffect(() => {
    if (clickFeedback) {
      const animate = () => {
        drawWaveform();
        const elapsed = Date.now() % 800;
        if (elapsed < 800) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }, [clickFeedback, drawWaveform]);

  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (showGradientMenu && !target.closest('.relative')) {
      setShowGradientMenu(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showGradientMenu]);

  // Auto-scroll to follow playback (but not during any user scrolling interaction)
  useEffect(() => {
    if (isPlaying && !isInertiaScrolling && !isMouseDragging) {
      const visibleDuration = duration / zoomLevel;
      const visibleEnd = scrollOffset + visibleDuration;
      
      if (currentTime > visibleEnd - visibleDuration * 0.1) {
        const newOffset = Math.min(duration - visibleDuration, currentTime - visibleDuration * 0.1);
        setScrollOffset(Math.max(0, newOffset));
      }
    }
  }, [currentTime, isPlaying, duration, zoomLevel, isInertiaScrolling, isMouseDragging]);

const switchGradientPattern = useCallback((pattern: 'linear' | 'radial' | 'conic' | 'wave' | 'energy') => {
  setGradientSettings((prev: GradientShaderSettings) => ({ ...prev, pattern }));
}, []);

const adjustIntensity = useCallback(() => {
  setGradientSettings((prev: GradientShaderSettings) => ({
    ...prev,
    intensity: (prev.intensity % 3) + 1
  }));
}, []);

const toggleGradient = useCallback(() => {
  setGradientSettings((prev: GradientShaderSettings) => ({ ...prev, enabled: !prev.enabled }));
}, []);

const getGradientClassName = useCallback((): string => {
  if (!gradientSettings.enabled) return '';
  
  const baseClass = 'gradient-shader-bg';
  const intensityClass = `intensity-${gradientSettings.intensity}`;
  
  let patternClass = '';
  switch (gradientSettings.pattern) {
    case 'radial':
      patternClass = 'pattern-1';
      break;
    case 'conic':
      patternClass = 'pattern-2';
      break;
    case 'wave':
      patternClass = 'pattern-3';
      break;
    case 'energy':
      patternClass = 'pattern-4';
      break;
    default: // linear
      patternClass = '';
  }
  
  return `${baseClass} ${patternClass} ${intensityClass}`.trim();
}, [gradientSettings]);

const getGradientStyle = useCallback((): React.CSSProperties => {
  if (!gradientSettings.enabled) return { display: 'none' };
  
  const opacityMap: Record<number, number> = { 1: 0.3, 2: 0.5, 3: 0.7 };
  const blurMap: Record<number, string> = { 1: '60px', 2: '40px', 3: '20px' };
  
  return {
    opacity: opacityMap[gradientSettings.intensity] || 0.5,
    filter: `blur(${blurMap[gradientSettings.intensity] || '40px'})`
  };
  }, [gradientSettings]);

  const handleDAWExport = async (format: DAWExportFormat) => {
    if (!userTierInfo) {
      alert('❌ Unable to determine your subscription tier. Please refresh and try again.');
      return;
    }

    if (!isExportFormatAvailable(format)) {
      const option = DAW_EXPORT_OPTIONS.find(opt => opt.value === format);
      const currentTier = userTierInfo.tier;
      const requiredTier = option?.tierRequired || 'producer';
      
      alert(`❌ ${option?.label} export requires ${requiredTier}+ plan. You're currently on ${currentTier}. Please upgrade to access this feature.`);
      return;
    }

    if (!annotations.length) {
      alert('❌ No annotations found to export!');
      return;
    }

    setIsExporting(true);
    setShowDAWExportMenu(false);

    try {
      // Extract clean filename from S3 URL
      const cleanFileName = extractCleanFilename(audioUrl, title);
      
      // Use your existing exportForDAW function
      const result = await exportForDAW(audioUrl, annotations, title, cleanFileName, format);
      
      const formatLabel = DAW_EXPORT_OPTIONS.find(opt => opt.value === format)?.label || format;
      
      // Special message for Reaper export explaining the process
      if (format === 'reaper-rpp') {
        alert(`✅ Successfully exported ${result.markerCount} annotations as ${formatLabel}!\n\n` +
              `📁 To use in Reaper:\n` +
              `1. Download your original audio file from Skribble\n` +
              `2. Rename it to: ${cleanFileName}\n` +
              `3. Place it in the same folder as the .rpp file\n` +
              `4. Open the .rpp file in Reaper\n\n` +
              `💡 Tip: The .rpp file expects "${cleanFileName}" - make sure your audio file has exactly this name!`);
      } else {
        alert(`✅ Successfully exported ${result.markerCount} annotations as ${formatLabel}!`);
      }

    } catch (error) {
      console.error('Export error:', error);
      alert(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const extractCleanFilename = (s3Url: string, fallbackTitle: string): string => {
    try {
      // Parse the S3 URL to extract the object key
      const url = new URL(s3Url);
      const pathname = url.pathname;
      
      // Extract the filename from the path (after the last slash)
      const pathParts = pathname.split('/');
      const s3Key = pathParts[pathParts.length - 1];
      
      // If it looks like a UUID filename, use the project title instead
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(s3Key.split('.')[0])) {
        // Use project title with file extension from S3 key
        const extension = s3Key.includes('.') ? '.' + s3Key.split('.').pop() : '.wav';
        const sanitizedTitle = fallbackTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
        return `${sanitizedTitle}${extension}`;
      }
      
      // If it has a reasonable filename, clean it up
      return decodeURIComponent(s3Key);
      
    } catch (error) {
      console.error('Error extracting filename:', error);
      // Fallback to project title + .wav
      const sanitizedTitle = fallbackTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
      return `${sanitizedTitle}.wav`;
    }
  };

  useEffect(() => {
  if (isViewOnly) {
    setShowAnnotations(true);
  }
}, [isViewOnly]);

const isExportFormatAvailable = (format: string): boolean => {
  if (!userTierInfo) return false;
  return userTierInfo.limits.allowedExportFormats.includes(format);
};

const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  // Ignore right-clicks (they're for dragging), during momentum scrolling, and phantom clicks after drag
  if (e.button === 2 || isMouseDragging || isInertiaScrolling || justCompletedDrag) {
    return;
  }
  
  const canvas = canvasRef.current;
  if (!canvas || duration === 0) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;

  // First check if we clicked on an annotation
  if (hoveredAnnotation) {
    seekTo(hoveredAnnotation.timestamp);
    return;
  }

  // Left-click for seeking
  const progress = mouseX / rect.width;
  const visibleDuration = duration / zoomLevel;
  const newTime = scrollOffset + (progress * visibleDuration);
  
  // Add visual click feedback
  setClickFeedback({
    x: mouseX,
    timestamp: Date.now()
  });
  
  seekTo(newTime);
  
  // Clear click feedback after animation
  setTimeout(() => setClickFeedback(null), 800);
};


const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
  // Don't preventDefault - let React handle passive events
  
  const canvas = canvasRef.current;
  if (!canvas || !isAudioReady) return;
  
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const touchX = touch.clientX - rect.left;
  
  setIsDragging(true);
  setDragStart({ x: touchX, offset: scrollOffset });
  
  // Provide haptic feedback on supported devices
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}, [isAudioReady, scrollOffset]);


const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
  // Don't preventDefault - let React handle passive events
  
  if (!isDragging || !canvasRef.current || !dragStart) return;
  
  const touch = e.touches[0];
  const rect = canvasRef.current.getBoundingClientRect();
  const touchX = touch.clientX - rect.left;
  
  // Handle horizontal scrolling/seeking
  const deltaX = touchX - dragStart.x;
  const visibleDuration = duration / zoomLevel;
  const timePerPixel = visibleDuration / rect.width;
  const deltaTime = deltaX * timePerPixel;
  
  // Update scroll offset for smooth panning
  const newScrollOffset = Math.max(0, Math.min(
    duration - visibleDuration,
    dragStart.offset - deltaTime
  ));
  
  setScrollOffset(newScrollOffset);
}, [isDragging, dragStart, duration, zoomLevel]);

const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
  // Don't preventDefault - let React handle passive events

  const canvas = canvasRef.current;
  if (!canvas || !isAudioReady) return;

  // If it was a tap (not a drag), seek to that position
  // Increased threshold for mobile to handle touch variations
  const touchThreshold = 15; // Increased from 10 to 15 pixels
  if (isDragging && dragStart && Math.abs(e.changedTouches[0].clientX - dragStart.x) < touchThreshold) {
    const rect = canvas.getBoundingClientRect();
    const touchX = e.changedTouches[0].clientX - rect.left;
    
    // Check if we tapped on an annotation first
    const visibleAnnotations = getVisibleAnnotations();
    let tappedAnnotation = null;
    
    for (const annotation of visibleAnnotations) {
      const annotationX = annotation.screenX * rect.width;
      const bubbleDimensions = getAnnotationBubbleDimensions();
      const bubbleX = annotationX - bubbleDimensions.width / 2;

      if (touchX >= bubbleX && touchX <= bubbleX + bubbleDimensions.width) {
        tappedAnnotation = annotation;
        break;
      }
    }

    if (tappedAnnotation) {
      seekTo(tappedAnnotation.timestamp);
    } else {
      // Seek to tapped position
      const progress = touchX / rect.width;
      const visibleDuration = duration / zoomLevel;
      const newTime = scrollOffset + (progress * visibleDuration);
      
      // Add visual click feedback for mobile
      setClickFeedback({
        x: touchX,
        timestamp: Date.now()
      });
      
      seekTo(newTime);
      
      // Clear click feedback after animation
      setTimeout(() => setClickFeedback(null), 800);
    }
    
    // Provide haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }

  setIsDragging(false);
  setDragStart({ x: 0, offset: 0 });
}, [isDragging, dragStart, isAudioReady, duration, zoomLevel, scrollOffset, getVisibleAnnotations, seekTo]);
            
// Mobile-optimized double-tap to zoom
const handleDoubleTap = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
  // Don't preventDefault - let React handle passive events
  
  const canvas = canvasRef.current;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const touchX = e.touches[0]?.clientX || e.changedTouches[0]?.clientX;
  const centerProgress = (touchX - rect.left) / rect.width;
  
  // Double-tap to zoom in/out
  if (zoomLevel === 1) {
    // Zoom in to 3x centered on tap location
    const visibleDuration = duration / 3;
    const timeUnderTap = scrollOffset + (centerProgress * (duration / zoomLevel));
    const newScrollOffset = Math.max(0, Math.min(
      duration - visibleDuration,
      timeUnderTap - (0.5 * visibleDuration)
    ));
    
    setZoomLevel(3);
    setScrollOffset(newScrollOffset);
  } else {
    // Zoom out to 1x
    resetZoom();
  }
  
  // Provide haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(30);
  }
}, [zoomLevel, scrollOffset, duration, resetZoom]);

const handleTimeUpdate = () => {
  // ✅ FIXED: Use audioRef.current instead of undefined 'audio'
  if (!audioRef.current) return;
  
  const newTime = audioRef.current.currentTime;
  setCurrentTime(newTime);
  
  // 🎯 KEY FEATURE: Update cursor position only if we're playing (not seeking)
  if (isPlaying && !shouldResumeFromCursor) {
    setLastCursorPosition(newTime);
  }
  
  onTimeUpdate?.(newTime);
};

const handleEnded = () => {
  setIsPlaying(false);
  setCurrentTime(0);
  setLastCursorPosition(0);
  setPausedByUser(false);
  setShouldResumeFromCursor(false);
};

const GradientMenu = ({ 
  className,
  gradientSettings,
  setGradientSettings 
}: { 
  className?: string;
  gradientSettings: any;
  setGradientSettings: any;
}) => {
  if (!showGradientMenu) return null;

  const patterns = [
    { 
      key: 'linear', 
      icon: RotateCcw, 
      label: 'Linear',
      description: 'Flowing diagonal gradients'
    },
    { 
      key: 'radial', 
      icon: Sun, 
      label: 'Radial',
      description: 'Depth-creating radial bursts'
    },
    { 
      key: 'conic', 
      icon: Sparkles, 
      label: 'Conic',
      description: 'Rotating energy field'
    },
    { 
      key: 'wave', 
      icon: '〰️', 
      label: 'Wave',
      description: 'Audio-inspired flowing waves'
    },
    { 
      key: 'energy', 
      icon: '⚡', 
      label: 'Energy',
      description: 'Pulsing energy core'
    }
  ];


  return (
    <div className={className || "absolute bottom-full right-0 mb-2 bg-skribble-dark/95 backdrop-blur-md border border-skribble-azure/20 rounded-lg p-4 min-w-64 z-50 shadow-xl"}>
      {/* Header with Toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          <span className="text-sm text-skribble-sky font-medium">Background Shaders</span>
        </div>
        <button
          onClick={toggleGradient}
          className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
            gradientSettings.enabled ? 'bg-skribble-azure' : 'bg-skribble-purple/50'
          }`}
        >
          <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform duration-300 shadow-md ${
            gradientSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
      
      {gradientSettings.enabled && (
        <>
          {/* Patterns - Mobile: Vertical list, Desktop: Horizontal grid */}
          <div className="mb-3">
            <div className="text-xs text-skribble-azure mb-2">Pattern</div>
            {/* Mobile: Vertical layout */}
            <div className="space-y-1 sm:hidden">
              {patterns.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => switchGradientPattern(key as any)}
                  className={`w-full p-2 rounded text-left transition-all duration-200 border ${
                    gradientSettings.pattern === key
                      ? 'bg-skribble-azure/20 border-skribble-azure text-skribble-sky'
                      : 'bg-skribble-purple/20 border-skribble-purple/30 text-skribble-azure hover:bg-skribble-purple/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {typeof Icon === 'string' ? (
                      <span className="text-sm">{Icon}</span>
                    ) : (
                      <Icon className="w-3 h-3 flex-shrink-0" />
                    )}
                    <span className="text-xs">{label}</span>
                  </div>
                </button>
              ))}
            </div>
            {/* Desktop: Horizontal grid */}
            <div className="hidden sm:grid grid-cols-5 gap-1">
              {patterns.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => switchGradientPattern(key as any)}
                  className={`p-2 rounded text-center transition-all duration-200 border ${
                    gradientSettings.pattern === key
                      ? 'bg-skribble-azure/20 border-skribble-azure text-skribble-sky'
                      : 'bg-skribble-purple/20 border-skribble-purple/30 text-skribble-azure hover:bg-skribble-purple/30'
                  }`}
                  title={label}
                >
                  <div className="flex flex-col items-center gap-1">
                    {typeof Icon === 'string' ? (
                      <span className="text-sm">{Icon}</span>
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                    <span className="text-xs leading-tight">{label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Intensity - Mobile: Vertical, Desktop: Horizontal */}
          <div>
            <div className="text-xs text-skribble-azure mb-2">Intensity</div>
            {/* Mobile: Vertical layout */}
            <div className="space-y-1 sm:hidden">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  onClick={() => setGradientSettings((prev: GradientShaderSettings) => ({ ...prev, intensity: level }))}
                  className={`w-full py-2 px-3 rounded text-left text-xs transition-all duration-200 ${
                    gradientSettings.intensity === level
                      ? 'bg-skribble-azure text-white'
                      : 'bg-skribble-purple/20 text-skribble-azure hover:bg-skribble-purple/40'
                  }`}
                >
                  {['Low', 'Medium', 'High'][level - 1]}
                </button>
              ))}
            </div>
            {/* Desktop: Horizontal grid */}
            <div className="hidden sm:grid grid-cols-3 gap-1">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  onClick={() => setGradientSettings((prev: GradientShaderSettings) => ({ ...prev, intensity: level }))}
                  className={`py-1.5 px-2 rounded text-xs transition-all duration-200 ${
                    gradientSettings.intensity === level
                      ? 'bg-skribble-azure text-white'
                      : 'bg-skribble-purple/20 text-skribble-azure hover:bg-skribble-purple/40'
                  }`}
                >
                  {['Low', 'Med', 'High'][level - 1]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

return (
  <div className="space-y-4 sm:space-y-6">
    {/* Audio Player - Mobile-first design */}
    <div className="bg-skribble-plum/30 backdrop-blur-md rounded-lg sm:rounded-xl border border-skribble-azure/20 overflow-hidden">
      
      {/* Mobile-Optimized Header */}
      <div className="p-3 sm:p-6 pb-2 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <h3 className="font-madimi text-base sm:text-lg text-skribble-sky">{title}</h3>
          
          {/* Mobile Action Row */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
            {/* Mobile Status Indicators */}
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              {!userInteracted && (
                <div className="flex items-center gap-1 text-orange-400">
                  <span className="hidden sm:inline">🎵 Click anywhere to enable audio</span>
                  <span className="sm:hidden">🎵 Tap to enable</span>
                </div>
              )}
              
              {isGeneratingWaveform && (
                <div className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-skribble-azure" />
                  <span className="text-skribble-azure hidden sm:inline">Generating waveform...</span>
                  <span className="text-skribble-azure sm:hidden">Loading...</span>
                </div>
              )}
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Version Control - Compact on mobile */}
              <button
                onClick={() => setShowVersionControl(!showVersionControl)}
                className="p-1.5 sm:p-2 text-skribble-azure hover:text-skribble-sky transition-colors bg-skribble-dark/20 rounded-lg touch-manipulation"
                title="Version History"
              >
                <History className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Export Button - Mobile optimized */}
              {!isViewOnly && (
                <div className="relative">
                  <button
                    onClick={() => setShowDAWExportMenu(!showDAWExportMenu)}
                    disabled={isExporting}
                    className="p-1.5 sm:p-2 text-skribble-azure hover:text-skribble-sky transition-colors disabled:opacity-50 text-xs sm:text-sm touch-manipulation"
                    title="Export to DAW"
                  >
                    <span className="hidden sm:inline">Export to DAW</span>
                    <span className="sm:hidden">Export</span>
                  </button>
                  
                  {/* Export Menu - Mobile responsive (Part 2 will contain this) */}
                  <CollaboratorsMenuPortal>
                    {showDAWExportMenu && (
                      <div 
                        ref={dawExportMenuRef} 
                        className="fixed inset-x-4 bottom-4 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-96 bg-skribble-plum/95 sm:bg-skribble-plum/30 backdrop-blur-md rounded-xl shadow-xl border border-skribble-azure/20 z-50 overflow-hidden max-h-[80vh] overflow-y-auto mobile-sheet"
                      >
                        {/* Export menu content will be in Part 2 */}
                        <div className="p-4 sm:p-6">
                          <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <h3 className="font-madimi text-base sm:text-lg text-skribble-sky">Export to DAW</h3>
                            <button
                              onClick={() => setShowDAWExportMenu(false)}
                              className="p-1.5 text-skribble-azure/60 hover:text-skribble-azure transition-colors touch-manipulation"
                            >
                              <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                          
                          {/* Tier Status Card */}
                          {userTierInfo && (
                            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-skribble-dark/20 rounded-lg border border-skribble-azure/10">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs sm:text-sm text-skribble-azure">Current Plan</span>
                                <span className="px-2 sm:px-3 py-1 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white text-xs sm:text-sm rounded-full font-medium capitalize">
                                  {userTierInfo.tier}
                                </span>
                              </div>
                              {userTierInfo.limits.allowedExportFormats.length === 0 ? (
                                <p className="text-xs sm:text-sm text-amber-400">
                                  <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                                  Export requires Indie plan or higher
                                </p>
                              ) : (
                                <p className="text-xs sm:text-sm text-green-400">
                                  <Check className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                                  {userTierInfo.limits.allowedExportFormats.length} format{userTierInfo.limits.allowedExportFormats.length !== 1 ? 's' : ''} available
                                </p>
                              )}
                            </div>
                          )}

                          {/* Export Options - Mobile optimized */}
                          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                            {DAW_EXPORT_OPTIONS.map((option) => {
                              const isAvailable = isExportFormatAvailable(option.value);
                              const isDisabled = !userTierInfo || !isAvailable;

                              return (
                                <button
                                  key={option.value}
                                  onClick={() => !isDisabled && handleDAWExport(option.value)}
                                  disabled={isDisabled || isExporting}
                                  className={`w-full text-left p-3 sm:p-4 rounded-lg border transition-all duration-200 group touch-manipulation ${
                                    isDisabled
                                      ? 'bg-skribble-dark/10 border-skribble-purple/20 cursor-not-allowed opacity-50'
                                      : 'bg-skribble-dark/20 border-skribble-azure/20 hover:border-skribble-azure/40 hover:bg-skribble-azure/10 cursor-pointer hover:shadow-md hover:shadow-skribble-azure/10'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-2 sm:space-x-3 flex-1">
                                      <span className="text-xl sm:text-2xl mt-0.5 sm:mt-1">{option.icon}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-medium text-skribble-sky group-hover:text-skribble-azure transition-colors text-sm sm:text-base">
                                            {option.label}
                                          </span>
                                          {!isAvailable && (
                                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                                              {option.tierRequired}+
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs sm:text-sm text-skribble-azure/80 mb-1">
                                          {option.description}
                                        </p>
                                        {option.detail && (
                                          <p className="text-xs text-skribble-purple">
                                            {option.detail}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {isExporting && (
                                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-skribble-azure mt-1 sm:mt-2 flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* Upgrade prompts and info card would go here - keeping existing content */}
                        </div>
                      </div>
                    )}
                  </CollaboratorsMenuPortal>
                </div>
              )}

              {/* Annotations Toggle - Mobile optimized */}
              {!isViewOnly ? (
                <button
                  onClick={() => setShowAnnotations(!showAnnotations)}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition-colors touch-manipulation ${
                    showAnnotations 
                      ? 'bg-skribble-azure text-white' 
                      : 'text-skribble-azure hover:text-skribble-sky bg-skribble-azure/10'
                  }`}
                >
                  <span className="hidden sm:inline">Annotations </span>
                  ({annotations.length})
                </button>
              ) : (
                <div className="px-2 sm:px-3 py-1 rounded text-xs sm:text-sm text-skribble-azure bg-skribble-azure/10">
                  {annotations.length} notes
                </div>
              )}

              {/* Zoom Controls - Compact on mobile */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-skribble-dark/20 rounded-lg p-1">
                <button
                  onClick={zoomOut}
                  className="p-1 text-skribble-azure hover:text-skribble-sky transition-colors disabled:opacity-30 touch-manipulation"
                  disabled={zoomLevel <= MIN_ZOOM}
                >
                  <ZoomOut className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
                <span className="text-xs text-skribble-azure px-1 sm:px-2 min-w-[2rem] sm:min-w-[3rem] text-center">
                  {zoomLevel.toFixed(1)}x
                </span>
                <button
                  onClick={zoomIn}
                  className="p-1 text-skribble-azure hover:text-skribble-sky transition-colors disabled:opacity-30 touch-manipulation"
                  disabled={zoomLevel >= MAX_ZOOM}
                >
                  <ZoomIn className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={resetZoom}
                  className="p-1 text-skribble-azure hover:text-skribble-sky transition-colors ml-0.5 sm:ml-1 touch-manipulation"
                >
                  <Home className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message - Mobile responsive */}
        {errorMessage && (
          <div className="mx-3 sm:mx-6 mb-3 sm:mb-4 bg-red-50 border border-red-200 rounded-lg p-3 mobile-error">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs sm:text-sm text-red-800">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Shortcut Tips */}
      <div className="px-3 pb-2 hidden sm:block">
        <div className="flex items-center gap-4 text-xs text-skribble-azure/60 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="bg-skribble-azure/10 px-1.5 py-0.5 rounded text-xs">Shift</span>
            <span>+</span>
            <span className="bg-skribble-azure/10 px-1.5 py-0.5 rounded text-xs">Wheel</span>
            <span>=</span>
            <span>Zoom</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-skribble-azure/10 px-1.5 py-0.5 rounded text-xs">Right Click</span>
            <span>=</span>
            <span>Scroll Waveform</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-skribble-azure/10 px-1.5 py-0.5 rounded text-xs">Space</span>
            <span>=</span>
            <span>Play/Pause</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-skribble-azure/10 px-1.5 py-0.5 rounded text-xs">Tab</span>
            <span>=</span>
            <span>Play from Last Click</span>
          </span>
        </div>
      </div>

      {/* FULL-WIDTH WAVEFORM SECTION - Mobile First */}
      <div className="relative">
        {/* Mobile: Remove padding for full-width effect */}
        <div 
          ref={waveformContainerRef}
          className="relative sm:mx-3 sm:mb-4 mobile-waveform-container"
          style={{ 
            minHeight: CANVAS_HEIGHT + 'px',
            height: CANVAS_HEIGHT + 'px',
            overflow: 'hidden',  // Hide scrollbar completely
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
              <div 
          className={getGradientClassName()}
          style={getGradientStyle()}
        />
          <canvas
            ref={canvasRef}
            className={`sm:rounded-lg border-t border-b sm:border border-skribble-azure/10 transition-all duration-200 waveform-canvas gesture-enabled mobile-canvas relative z-10 ${
              isMouseDragging ? 'cursor-grabbing' : 
              hoveredAnnotation ? 'cursor-pointer' : 
              'cursor-crosshair hover:border-skribble-azure/30'
            }`}
            style={{ 
              minWidth: '100%',
              width: '100%',
              height: CANVAS_HEIGHT + 'px',
              touchAction: 'pan-x pinch-zoom',
              backgroundColor: 'transparent'
            }}
            // Mouse events for desktop
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onClick={handleCanvasClick}
            onMouseLeave={(e) => {
              handleMouseLeave();
              // End any drag operation when mouse leaves canvas
              if (isMouseDragging) {
                setIsMouseDragging(false);
                setMouseDragStart({ x: 0, offset: 0 });
                setDragButton(0);
                if (canvasRef.current) {
                  canvasRef.current.style.cursor = 'crosshair';
                }
              }
            }}
            onContextMenu={(e) => e.preventDefault()} // Prevent right-click context menu
            // Touch events for mobile (keep your existing ones)
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* Enhanced Annotation Tooltip - Mobile responsive */}
          {hoveredAnnotation && (
            <div
              className="absolute z-50 bg-skribble-dark/95 backdrop-blur-sm text-skribble-sky text-xs p-3 sm:p-4 rounded-lg border border-skribble-azure/30 shadow-lg pointer-events-none max-w-xs sm:max-w-sm annotation-tooltip"
              style={{
                ...getTooltipPosition(hoveredAnnotation),
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              {/* Tooltip Arrow */}
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-skribble-dark/95"></div>
              
              {/* Header with user and timestamp */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full overflow-hidden bg-skribble-azure/20 flex-shrink-0">
                  {(() => {
                    const annotation = annotations.find(a => a.id === hoveredAnnotation.id);
                    return annotation?.user?.profileImage ? (
                      <UserAvatar 
                        user={{ username: annotation.user.username, profileImage: annotation.user.profileImage }}
                        size="xs"
                      />
                    ) : (
                      <div className="w-full h-full bg-skribble-azure/20 flex items-center justify-center">
                        <User className="w-2 h-2 text-skribble-azure" />
                      </div>
                    );
                  })()}
                </div>
                
                <span className="flex-shrink-0 font-medium text-xs sm:text-sm">{hoveredAnnotation.user}</span>
                <span className="text-skribble-purple">•</span>
                <span className="font-mono text-xs">{formatRulerTime(hoveredAnnotation.timestamp)}</span>
                <span 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getAnnotationColor(annotations.find(a => a.id === hoveredAnnotation.id)!) }}
                ></span>
              </div>
              
              {/* Main comment text */}
              <div className="text-skribble-sky leading-relaxed mb-2 sm:mb-3 text-xs sm:text-sm">
                {hoveredAnnotation.text}
              </div>
              
              {/* Metadata row */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="capitalize text-skribble-purple">{hoveredAnnotation.type}</span>
                  {annotations.find(a => a.id === hoveredAnnotation.id)?.priority && (
                    <>
                      <span className="text-skribble-azure">•</span>
                      <span className={`capitalize ${
                        annotations.find(a => a.id === hoveredAnnotation.id)?.priority === 'critical' ? 'text-red-400' :
                        annotations.find(a => a.id === hoveredAnnotation.id)?.priority === 'high' ? 'text-orange-400' :
                        annotations.find(a => a.id === hoveredAnnotation.id)?.priority === 'medium' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {annotations.find(a => a.id === hoveredAnnotation.id)?.priority}
                      </span>
                    </>
                  )}
                </div>
                <span className="text-skribble-azure ml-2 hidden sm:inline">Click to jump</span>
                <span className="text-skribble-azure ml-2 sm:hidden">Tap</span>
              </div>
            </div>
          )}

          {/* Click Feedback Indicator - Mobile responsive */}
          {clickFeedback && (
            <div
              className="absolute pointer-events-none z-40"
              style={{
                left: clickFeedback.x - 15,
                top: CANVAS_HEIGHT / 2 - 15,
                width: 30,
                height: 30
              }}
            >
              <div className="w-full h-full rounded-full border-2 border-skribble-sky animate-ping"></div>
              <div className="absolute inset-2 rounded-full bg-skribble-sky/20 animate-pulse"></div>
            </div>
          )}
          
          {/* Loading State - Mobile responsive */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-skribble-dark/50 sm:rounded-lg backdrop-blur-sm mobile-loading">
              <div className="text-center">
                <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-skribble-azure animate-spin mx-auto mb-2" />
                <p className="text-skribble-azure text-xs sm:text-sm">Loading audio...</p>
              </div>
            </div>
          )}

          {/* Error State - Mobile responsive */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-skribble-dark/50 sm:rounded-lg backdrop-blur-sm">
              <div className="text-center max-w-sm px-4 mobile-error">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3 mobile-error-icon">
                  <span className="text-red-400 text-lg sm:text-xl">⚠️</span>
                </div>
                <p className="text-red-400 text-xs sm:text-sm font-medium mb-2">Audio Error</p>
                <p className="text-red-300 text-xs">{error}</p>
                <button 
                  onClick={() => {
                    setError(null);
                    if (audioUrl && userInteracted) {
                      initializeAudio();
                    }
                  }}
                  className="mt-3 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/20 text-red-300 rounded-lg text-xs hover:bg-red-500/30 transition-colors touch-manipulation"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Time Display - Mobile responsive */}
          {!isLoading && !error && (
            <div className="absolute bottom-2 right-2 text-xs sm:text-sm text-skribble-azure font-mono bg-skribble-dark/20 rounded-lg px-2 py-1">
              {(() => {
                const ms = Math.floor((currentTime % 1) * 1000).toString().padStart(3, '0');
                return `${formatRulerTime(currentTime)}.${ms}`;
              })()}
            </div>
          )}
        </div>

        {/* Mobile Scroll Hint */}
        <div className="sm:hidden px-4 py-2 text-center mobile-only">
          <p className="text-xs text-skribble-azure/60">
            ← Scroll horizontally to explore the waveform →
          </p>
        </div>
      </div>

      {/* Time Ruler - Mobile responsive */}
      <div className="relative h-6 sm:h-8 mx-3 sm:mx-6 mb-6 sm:mb-4">
        <div className="absolute inset-0 bg-skribble-dark/20 rounded-lg border-t border-skribble-azure/10">
          {getTimeMarkers().map((marker, index) => (
            <div
              key={index}
              className="absolute top-0 bottom-0 flex flex-col"
              style={{ left: `${marker.position}%` }}
            >
              <div 
                className={`w-px ${
                  marker.isMajor 
                    ? 'bg-skribble-azure h-full' 
                    : 'bg-skribble-purple h-1/2'
                }`}
              />
              
              {marker.isMajor && (
                <div className="absolute top-full mt-1 transform -translate-x-1/2">
                  <span className="text-xs text-skribble-azure font-mono whitespace-nowrap">
                    {formatRulerTime(marker.time)}
                  </span>
                </div>
              )}
            </div>
          ))}
          
          {/* Playhead indicator */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-skribble-sky shadow-lg z-10"
              style={{
                left: `${((currentTime - scrollOffset) / (duration / zoomLevel)) * 100}%`,
                display: currentTime >= scrollOffset && currentTime <= scrollOffset + (duration / zoomLevel) ? 'block' : 'none'
              }}
            >
              <div className="absolute top-full mt-2 sm:mt-1 transform -translate-x-1/2">
                <div className="bg-skribble-azure text-white text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                  {formatRulerTime(currentTime)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile-First Controls */}
      <div className="p-3 sm:p-6 pt-4 sm:pt-5">
        {/* Mobile: Stack controls vertically */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 sm:items-center sm:justify-between">
          
          {/* Time Display - Larger on mobile */}
          <div className="text-sm sm:text-base text-skribble-azure font-mono text-center sm:text-left">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Playback Controls - Center on mobile */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <button
              onClick={skipBackward}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-skribble-dark/20 rounded-lg flex items-center justify-center hover:bg-skribble-dark/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none touch-manipulation"
              disabled={isLoading || !isAudioReady}
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 text-skribble-azure" />
            </button>
            
            <button
              onClick={togglePlayPause}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none touch-manipulation"
              disabled={isLoading || !isAudioReady || !userInteracted}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white ml-0.5" />
              )}
            </button>
            
            <button
              onClick={skipForward}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-skribble-dark/20 rounded-lg flex items-center justify-center hover:bg-skribble-dark/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none touch-manipulation"
              disabled={isLoading || !isAudioReady}
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 text-skribble-azure" />
            </button>
          </div>
          
          {/* Volume Controls - Compact on mobile */}
          <div className="flex items-center justify-center sm:justify-end gap-2 bg-skribble-dark/20 rounded-lg p-2 sm:p-0 sm:bg-transparent">
            <button
              onClick={toggleMute}
              className="p-1.5 sm:p-2 text-skribble-azure hover:text-skribble-sky transition-colors touch-manipulation"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 sm:w-20 h-1 bg-skribble-purple rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>

        {/* Secondary Controls Row - Mobile friendly */}
        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-skribble-azure/10">
          {/* Grid Controls - Compact on mobile */}
          <div className="flex items-center gap-2">
            <button
              onClick={cycleGridMode}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors touch-manipulation ${
                gridMode !== 'none'
                  ? 'bg-skribble-azure/20 text-skribble-azure'
                  : 'text-skribble-azure/60 hover:text-skribble-azure'
              }`}
              title="Toggle Grid Mode"
            >
              <Grid className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={handleTapTempo}
              className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-colors touch-manipulation ${
                isTapTempoMode
                  ? 'bg-skribble-azure text-white'
                  : 'text-skribble-azure hover:bg-skribble-azure/20'
              }`}
            >
              <span className="hidden sm:inline">Tap </span>({bpm} BPM)
            </button>
            
            <button
              onClick={alignGridToCursor}
              className="p-1.5 sm:p-2 text-skribble-azure/60 hover:text-skribble-azure transition-colors touch-manipulation"
              title="Align Grid to Cursor"
            >
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </div>
          {/* Gradient Background Controls - Mobile responsive */}
          <div className="relative">
            <button
              onClick={() => setShowGradientMenu(!showGradientMenu)}
              className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all duration-300 hover:scale-105 ${
                gradientSettings.enabled 
                  ? 'bg-skribble-azure/20 border-skribble-azure text-skribble-azure' 
                  : 'bg-skribble-purple/20 border-skribble-purple text-skribble-purple'
              }`}
              title="Background Shaders"
            >
              <Palette className="w-4 h-4" />
            </button>
            
            {showGradientMenu && (
              <GradientMenu
                gradientSettings={gradientSettings}
                setGradientSettings={setGradientSettings}
                className="absolute right-0 bottom-full mb-2 w-48 sm:w-80 md:w-96 bg-skribble-dark/95 backdrop-blur-md rounded-lg shadow-xl border border-skribble-azure/20 z-50 p-3"
              />
            )}
          </div>

          {/* Tempo Grid Controls - Mobile responsive */}
          <TempoGridControls
            bpm={bpm}
            gridMode={gridMode}
            gridOffset={gridOffset}
            currentTime={currentTime}
            audioUrl={audioUrl}
            userInteracted={userInteracted}
            onBpmChange={setBpm}
            onGridModeChange={setGridMode}
            onGridOffsetChange={setGridOffset}
            onGridOffsetMsChange={setGridOffsetMs}
            onDetectedBeatsChange={setDetectedBeats}
            className="flex-shrink-0 text-xs sm:text-sm mobile-optimized"
          />
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Mobile-optimized CSS */}
      <style jsx>{`
        /* Mobile-specific scrollbar styling */
        .mobile-waveform-container::-webkit-scrollbar {
          height: 4px;
        }
        
        .mobile-waveform-container::-webkit-scrollbar-track {
          background: rgba(62, 54, 79, 0.2);
        }
        
        .mobile-waveform-container::-webkit-scrollbar-thumb {
          background: rgba(113, 169, 247, 0.4);
          border-radius: 2px;
        }
        
        .mobile-waveform-container::-webkit-scrollbar-thumb:hover {
          background: rgba(113, 169, 247, 0.6);
        }

        /* Touch-friendly optimizations */
        .touch-manipulation {
          touch-action: manipulation;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }

        .gesture-enabled {
          touch-action: pan-x pinch-zoom;
          -webkit-user-select: none;
          -moz-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }

        /* Mobile canvas optimizations */
        @media (max-width: 640px) {
          .waveform-canvas {
            border-left: none;
            border-right: none;
            border-radius: 0;
            /* Force hardware acceleration */
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            /* Optimize rendering */
            image-rendering: optimizeSpeed;
            image-rendering: -webkit-optimize-contrast;
          }
          
          .mobile-waveform-container {
            /* Remove margins for full-width effect */
            margin-left: -0.75rem;
            margin-right: -0.75rem;
            /* Smooth horizontal scrolling */
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            /* Hide scrollbar while keeping functionality */
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          
          .annotation-tooltip {
            max-width: calc(100vw - 2rem);
            font-size: 0.75rem;
            line-height: 1.4;
            padding: 0.75rem;
          }
          
          .annotation-bubble {
            /* Larger touch targets */
            min-width: 44px;
            min-height: 44px;
            /* Better visibility */
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
        }

        /* Enhanced animations */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }
        
        .click-ripple {
          animation: ripple 0.6s ease-out;
        }
        
        /* Mobile-optimized slider */
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #71A9F7;
          cursor: pointer;
          border: 2px solid #C6D8FF;
        }
        
        .slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #71A9F7;
          cursor: pointer;
          border: 2px solid #C6D8FF;
        }

        /* Mobile modal positioning */
        .mobile-sheet {
          position: fixed !important;
          bottom: 0 !important;
          left: 1rem !important;
          right: 1rem !important;
          top: auto !important;
          transform: none !important;
          border-radius: 1rem 1rem 0 0 !important;
          max-height: 80vh !important;
          animation: slideUp 0.3s ease-out;
        }
        
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Loading shimmer for mobile */
        .mobile-loading {
          position: relative;
          overflow: hidden;
        }

        .mobile-loading::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(113, 169, 247, 0.1),
            transparent
          );
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
    {/* Annotation System - Mobile responsive */}
    {showAnnotations && !isViewOnly && currentUser && (
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-lg sm:rounded-xl p-4 sm:p-6 border border-skribble-azure/20 mobile-optimized">
        <AnnotationSystem
          audioFileId={audioFileId}
          currentTime={currentTime}
          onSeekTo={seekTo}

          currentUser={currentUser}
          onAnnotationCreated={handleAnnotationCreated}
          onAnnotationUpdated={handleAnnotationUpdated}
          onAnnotationDeleted={handleAnnotationDeleted}
          analyser={analyserRef.current}
          isPlaying={isPlaying}
          audioBuffer={null}
          // className="mobile-optimized"
        />
      </div>
    )} 

    {/* Version Control - Mobile responsive */}
    {showVersionControl && (
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-lg sm:rounded-xl p-4 sm:p-6 border border-skribble-azure/20 mobile-optimized">
        <VersionControl
          projectId={projectId}
          currentUser={currentUser}
          onVersionChange={onVersionChange || (() => {})}
          onError={handleVersionError}
          // className="mobile-optimized"
        />
      </div>
    )}
  </div>
  );
}
