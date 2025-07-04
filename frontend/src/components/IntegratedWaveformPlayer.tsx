import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Clock, SkipBack, SkipForward, History, Volume2, X, Info, VolumeX, Loader2, AlertCircle, Zap, Sparkles, Check, ZoomIn, ZoomOut, Home, Grid, User } from 'lucide-react';
import AnnotationSystem from './AnnotationSystem';
import TempoGridControls from './TempoGridControls';
import VersionControl from './VersionControl';
import UserAvatar from './userAvatar';
import { DAWExportFormat } from '../lib/audioUtils';
import CollaboratorsMenuPortal from './Portal';



interface WaveformPlayerProps {
  audioUrl: string;
  audioFileId: string;
  projectId: string;
  title?: string;
  isViewOnly?: boolean;
  initialAnnotations?: any[];
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
  const ANNOTATION_BUBBLE_HEIGHT = 32;
  const ANNOTATION_BUBBLE_WIDTH = 36;

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
          console.log('Audio load started');
        };
  
        const onProgress = () => {
          console.log('Audio loading progress:', {
            buffered: audio.buffered.length > 0 ? audio.buffered.end(0) : 0,
            duration: audio.duration
          });
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

  // Calculate time markers for the ruler
  const getTimeMarkers = useCallback(() => {
    const visibleDuration = duration / zoomLevel;
    const startTime = scrollOffset;
    const endTime = startTime + visibleDuration;
    
    let interval: number;
    if (visibleDuration <= 10) {
      interval = 0.5;
    } else if (visibleDuration <= 30) {
      interval = 1;
    } else if (visibleDuration <= 60) {
      interval = 5;
    } else if (visibleDuration <= 300) {
      interval = 10;
    } else if (visibleDuration <= 600) {
      interval = 30;
    } else {
      interval = 60;
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
      top: ANNOTATION_BUBBLE_HEIGHT + 15
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
    const lineColor = getAnnotationColor(annotation);
    const lineWidth = isHovered ? 3 : 2;
    const alpha = isHovered ? 0.9 : 0.6;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, ANNOTATION_BUBBLE_HEIGHT + 8);
    ctx.lineTo(x, height - 5);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (isHovered) {
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, ANNOTATION_BUBBLE_HEIGHT + 8);
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
    const bubbleX = x - ANNOTATION_BUBBLE_WIDTH / 2;
    const bubbleY = 5;
    const bubbleColor = getAnnotationColor(annotation);
    const scale = isHovered ? 1.1 : 1;
    
    ctx.save();
    
    if (isHovered) {
      ctx.translate(x, bubbleY + ANNOTATION_BUBBLE_HEIGHT / 2);
      ctx.scale(scale, scale);
      ctx.translate(-x, -(bubbleY + ANNOTATION_BUBBLE_HEIGHT / 2));
    }
    
    ctx.fillStyle = bubbleColor;
    ctx.shadowColor = isHovered ? bubbleColor : 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = isHovered ? 12 : 6;
    ctx.shadowOffsetY = 2;
    
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, ANNOTATION_BUBBLE_WIDTH, ANNOTATION_BUBBLE_HEIGHT - 6, 8);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x - 6, bubbleY + ANNOTATION_BUBBLE_HEIGHT - 6);
    ctx.lineTo(x, bubbleY + ANNOTATION_BUBBLE_HEIGHT + 2);
    ctx.lineTo(x + 6, bubbleY + ANNOTATION_BUBBLE_HEIGHT - 6);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    drawAnnotationIcon(ctx, x, bubbleY + 4, annotation.annotationType, isHovered);
    drawPriorityIndicator(ctx, bubbleX + ANNOTATION_BUBBLE_WIDTH - 8, bubbleY + 4, annotation.priority);
    
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

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  // Update canvas size to match container
  const container = waveformContainerRef.current;
  if (container) {
    canvas.width = container.clientWidth;
    canvas.height = CANVAS_HEIGHT;
  }

  const { width, height } = canvas;
  const visibleWaveform = getVisibleWaveform();
  const visibleDuration = duration / zoomLevel;
  const progress = duration > 0 ? (currentTime - scrollOffset) / visibleDuration : 0;
  
  // Clear canvas with background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, width, height);
  
  // Draw grid first (if enabled)
  if (gridMode !== 'none') {
  drawGridEnhanced(ctx, width, height, visibleDuration);
}
  
  // Draw waveform with performance optimization
  if (visibleWaveform.length > 0) {
    const barWidth = width / visibleWaveform.length;
    const centerY = height / 2;
    
    // Create paths for batch rendering
    const backgroundPath = new Path2D();
    const progressPath = new Path2D();
    
    visibleWaveform.forEach((sample, i) => {
      const barHeight = sample * height * 0.7;
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
    ctx.fillStyle = '#6B5CA5';
    ctx.fill(backgroundPath);
    
    // Batch render progress waveform
    if (progress > 0) {
      ctx.fillStyle = 'deepskyblue';
      ctx.fill(progressPath);
    }
  }
  
  // Draw playhead
  if (currentTime >= scrollOffset && currentTime <= scrollOffset + visibleDuration) {
    const playheadX = ((currentTime - scrollOffset) / visibleDuration) * width;
    
    ctx.strokeStyle = '#C6D8FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    
    ctx.fillStyle = '#C6D8FF';
    ctx.beginPath();
    ctx.arc(playheadX, height - 10, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw annotations on top
  drawAnnotations(ctx, width, height);
  
}, [waveformData, currentTime, duration, zoomLevel, scrollOffset, gridMode, bpm, gridOffset]);

  // Enhanced mouse tracking for hover effects (FIXED)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setMousePosition({ x: mouseX, y: mouseY });

    const visibleAnnotations = getVisibleAnnotations();
    let foundHover: HoveredAnnotation | null = null;

    for (const annotation of visibleAnnotations) {
      const x = annotation.screenX * rect.width;
      const bubbleX = x - ANNOTATION_BUBBLE_WIDTH / 2;
      const bubbleY = 5;
      
      const isOverBubble = mouseX >= bubbleX && 
                          mouseX <= bubbleX + ANNOTATION_BUBBLE_WIDTH && 
                          mouseY >= bubbleY && 
                          mouseY <= bubbleY + ANNOTATION_BUBBLE_HEIGHT;
      
      const isOverLine = mouseX >= x - 4 && 
                        mouseX <= x + 4 && 
                        mouseY >= bubbleY + ANNOTATION_BUBBLE_HEIGHT;

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
  }, [getVisibleAnnotations]);

  // Enhanced mouse leave handler (FIXED)
  const handleMouseLeave = useCallback(() => {
  setHoveredAnnotation(null);
  setMousePosition(null);
}, []);

  // Enhanced canvas click handler (FIXED for both issues)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // First check if we clicked on an annotation (FIXED)
    if (hoveredAnnotation) {
      seekTo(hoveredAnnotation.timestamp);
      return;
    }

    // Use rect.width for proper cursor positioning (FIXED)
    const progress = mouseX / rect.width;
    const visibleDuration = duration / zoomLevel;
    const newTime = scrollOffset + (progress * visibleDuration);
    seekTo(newTime);
  };

  // Enhanced seek function with visual feedback
  const seekTo = (time: number) => {
    if (!audioRef.current || !isAudioReady) return;
    
    const audio = audioRef.current;
    const clampedTime = Math.max(0, Math.min(time, duration));
        
    // Add visual feedback
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const visibleDuration = duration / zoomLevel;
      const relativeTime = clampedTime - scrollOffset;
      const x = (relativeTime / visibleDuration) * rect.width;
      
      setClickFeedback({ x, timestamp: clampedTime });
      setTimeout(() => setClickFeedback(null), 800);
    }
    
    audio.currentTime = clampedTime;
  };

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
  e.preventDefault();
  
  if (!canvasRef.current) return;
  
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
      console.warn('Audio not ready for playback');
      return;
    }

    const audio = audioRef.current;

    try {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (isPlaying) {
        audio.pause();
      } else {
        if (audio.readyState >= 2) {
          await audio.play();
        } else {
          console.warn('Audio not ready, loading...');
          audio.load();
          await new Promise((resolve) => {
            audio.addEventListener('canplay', resolve, { once: true });
          });
          await audio.play();
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

  const handleTimeUpdate = () => {
    const currentTime = audio.currentTime;
    setCurrentTime(currentTime);
    onTimeUpdate?.(currentTime);
  };

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
    if (
      e.code === 'Space' && 
      !e.ctrlKey && 
      !e.metaKey && 
      !e.altKey && 
      !e.shiftKey
    ) {
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

      e.preventDefault();
      
      console.log('⌨️ Spacebar pressed - toggling playback');
      
      // 🔑 CRITICAL FIX: Use current values instead of closure values
      const currentAudioRef = audioRef.current;
      const currentIsAudioReady = isAudioReady;
      const currentUserInteracted = userInteracted;
      const currentAudioUrl = audioUrlState;
      
      console.log('🔍 Spacebar state check:', {
        hasAudioRef: !!currentAudioRef,
        isAudioReady: currentIsAudioReady,
        userInteracted: currentUserInteracted,
        hasAudioUrl: !!currentAudioUrl,
        audioSrc: currentAudioRef?.src?.substring(0, 50)
      });
      
      // Handle the toggle directly instead of calling the function
      if (!currentUserInteracted) {
        setUserInteracted(true);
        if (currentAudioUrl && currentAudioUrl.startsWith('http')) {
          initializeAudio(currentAudioUrl);
        }
        return;
      }

      if (!currentAudioRef || !currentIsAudioReady) {
        console.warn('⚠️ Audio not ready for spacebar playback');
        return;
      }

      // Direct audio control
      if (currentAudioRef.paused) {
        console.log('▶️ Spacebar play');
        currentAudioRef.play().catch(console.error);
      } else {
        console.log('⏸️ Spacebar pause');
        currentAudioRef.pause();
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}, []);

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

  // Auto-scroll to follow playback
  useEffect(() => {
    if (isPlaying) {
      const visibleDuration = duration / zoomLevel;
      const visibleEnd = scrollOffset + visibleDuration;
      
      if (currentTime > visibleEnd - visibleDuration * 0.1) {
        const newOffset = Math.min(duration - visibleDuration, currentTime - visibleDuration * 0.1);
        setScrollOffset(Math.max(0, newOffset));
      }
    }
  }, [currentTime, isPlaying, duration, zoomLevel, scrollOffset]);

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
    // Import your existing export function
    const { exportForDAW } = await import('../lib/audioUtils');
    
    const audioFileName = audioUrl.split('/').pop() || 'audio.wav';
    const result = await exportForDAW(audioUrl, annotations, title, audioFileName, format);
    
    const formatLabel = DAW_EXPORT_OPTIONS.find(opt => opt.value === format)?.label || format;
    alert(`✅ Successfully exported ${result.markerCount} annotations as ${formatLabel}!`);

  } catch (error) {
    console.error('Export error:', error);
    alert(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsExporting(false);
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

  return (
    <div className="space-y-6">
      {/* Audio Player */}
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20">
        {/* Header */}
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-madimi text-lg text-skribble-sky">{title}</h3>
          <div className="flex items-center gap-2 bg-skribble-dark/20 rounded-lg">
            {!userInteracted && (
              <div className="flex items-center gap-2 text-sm text-orange-400">
                <span>🎵 Click anywhere to enable audio</span>
              </div>
            )}
            
            {isGeneratingWaveform && (
              <div className="flex items-center gap-2 text-sm text-skribble-azure">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating waveform...
              </div>
            )}
            <button
              onClick={() => setShowVersionControl(!showVersionControl)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Version History"
            >
              <History className="w-5 h-5 text-skribble-azure hover:text-skribble-sky bg-skribble-dark/20 rounded-lg " />
            </button>
              {errorMessage && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}
              {!isViewOnly && (
                <div className="relative">
                  <button
                    onClick={() => setShowDAWExportMenu(!showDAWExportMenu)}
                    disabled={isExporting}
                    className="p-2 font-medium text-skribble-azure hover:text-skribble-sky transition-colors disabled:opacity-50"
                    title="Export to DAW"
                  >
                    Export to DAW
                  </button>
                  <CollaboratorsMenuPortal>
                  
                  {showDAWExportMenu && (
                    <div 
                      ref={dawExportMenuRef} 
                      className="absolute top-full right-0 mt-2 w-96 bg-skribble-plum/30 backdrop-blur-md rounded-xl shadow-xl border border-skribble-azure/20 z-50 overflow-hidden"
                    >
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-madimi text-lg text-skribble-sky">Export to DAW</h3>
                          <button
                            onClick={() => setShowDAWExportMenu(false)}
                            className="p-1 text-skribble-azure/60 hover:text-skribble-azure transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Tier Status Card */}
                        {userTierInfo && (
                          <div className="mb-6 p-4 bg-skribble-dark/20 rounded-lg border border-skribble-azure/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-skribble-azure">Current Plan</span>
                              <span className="px-3 py-1 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white text-sm rounded-full font-medium capitalize">
                                {userTierInfo.tier}
                              </span>
                            </div>
                            {userTierInfo.limits.allowedExportFormats.length === 0 ? (
                              <p className="text-sm text-amber-400">
                                <AlertCircle className="w-4 h-4 inline mr-1" />
                                Export features require Indie plan or higher
                              </p>
                            ) : (
                              <p className="text-sm text-green-400">
                                <Check className="w-4 h-4 inline mr-1" />
                                {userTierInfo.limits.allowedExportFormats.length} export format{userTierInfo.limits.allowedExportFormats.length !== 1 ? 's' : ''} available
                              </p>
                            )}
                          </div>
                        )}

                        {/* Export Options */}
                        <div className="space-y-3 mb-6">
                          {DAW_EXPORT_OPTIONS.map((option) => {
                            const isAvailable = isExportFormatAvailable(option.value);
                            const isDisabled = !userTierInfo || !isAvailable;

                            return (
                              <button
                                key={option.value}
                                onClick={() => !isDisabled && handleDAWExport(option.value)}
                                disabled={isDisabled || isExporting}
                                className={`w-full text-left p-4 rounded-lg border transition-all duration-200 group ${
                                  isDisabled
                                    ? 'bg-skribble-dark/10 border-skribble-purple/20 cursor-not-allowed opacity-50'
                                    : 'bg-skribble-dark/20 border-skribble-azure/20 hover:border-skribble-azure/40 hover:bg-skribble-azure/10 cursor-pointer hover:shadow-md hover:shadow-skribble-azure/10'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start space-x-3 flex-1">
                                    <span className="text-2xl mt-1">{option.icon}</span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-skribble-sky group-hover:text-skribble-azure transition-colors">
                                          {option.label}
                                        </span>
                                        {!isAvailable && (
                                          <span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                                            {option.tierRequired}+
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-skribble-azure/80 mb-1">
                                        {option.description}
                                      </p>
                                      <p className="text-xs text-skribble-purple">
                                        {option.detail}
                                      </p>
                                    </div>
                                  </div>
                                  {isExporting && (
                                    <Loader2 className="w-5 h-5 animate-spin text-skribble-azure mt-2" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Upgrade Prompts */}
                        {userTierInfo?.tier === 'free' && (
                          <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20 mb-4">
                            <div className="flex items-start gap-3">
                              <Sparkles className="w-5 h-5 text-purple-400 mt-0.5" />
                              <div>
                                <h4 className="font-medium text-skribble-sky mb-1">🎵 Unlock Professional Export!</h4>
                                <p className="text-sm text-skribble-azure mb-3">
                                  Upgrade to Indie ($7/month) to export with embedded annotations that appear automatically in your DAW.
                                </p>
                                <button 
                                  onClick={() => window.open('/pricing', '_blank')}
                                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25"
                                >
                                  View Plans
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {userTierInfo?.tier === 'indie' && (
                          <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg border border-green-500/20 mb-4">
                            <div className="flex items-start gap-3">
                              <Zap className="w-5 h-5 text-green-400 mt-0.5" />
                              <div>
                                <h4 className="font-medium text-skribble-sky mb-1">🚀 Want All DAW Formats?</h4>
                                <p className="text-sm text-skribble-azure mb-3">
                                  Upgrade to Producer ($19/month) for Reaper, Logic, Pro Tools, and Ableton export.
                                </p>
                                <button 
                                  onClick={() => window.open('/pricing', '_blank')}
                                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white text-sm rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25"
                                >
                                  Upgrade Plan
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Info Card */}
                        <div className="p-4 bg-skribble-azure/10 rounded-lg border border-skribble-azure/20">
                          <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-skribble-azure mt-0.5" />
                            <div>
                              <h4 className="font-medium text-skribble-sky mb-1">💡 How it works</h4>
                              <p className="text-xs text-skribble-azure mb-2">
                                Your annotations are embedded directly into the exported files. When you open them in your DAW, all markers appear automatically on the timeline!
                              </p>
                              <div className="text-xs text-skribble-purple">
                                <strong>File Format Tips:</strong><br />
                                • WAV files: Annotations embed directly into audio<br />
                                • MP3/M4A files: Exports marker files for import<br />
                                • For best results: Upload WAV files to Skribble
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </CollaboratorsMenuPortal>
                </div>
              )}
           {!isViewOnly ? (
              <button
                onClick={() => setShowAnnotations(!showAnnotations)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  showAnnotations 
                    ? 'bg-skribble-azure text-white' 
                    : 'text-skribble-azure hover:text-skribble-sky'
                }`}
              >
                Annotations ({annotations.length})
              </button>
            ) : (
              <div className="px-3 py-1 rounded text-sm text-skribble-azure bg-skribble-azure/10">
                {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} • View-only
              </div>
            )}
            
            <div className="flex items-center gap-1 bg-skribble-dark/20 rounded-lg p-1">
              <button
                onClick={zoomOut}
                className="p-1 text-skribble-azure hover:text-skribble-sky transition-colors"
                disabled={zoomLevel <= MIN_ZOOM}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-skribble-azure px-2 min-w-[3rem] text-center">
                {zoomLevel.toFixed(1)}x
              </span>
              <button
                onClick={zoomIn}
                className="p-1 text-skribble-azure hover:text-skribble-sky transition-colors"
                disabled={zoomLevel >= MAX_ZOOM}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                className="p-1 text-skribble-azure hover:text-skribble-sky transition-colors ml-1"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Waveform Canvas with Click Feedback */}
        <div 
          ref={waveformContainerRef}
          className="relative mb-4"
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={CANVAS_HEIGHT}
            className={`w-full bg-skribble-dark/30 rounded-lg border border-skribble-azure/10 transition-all duration-200 ${
              isDragging ? 'cursor-grabbing' : 
              hoveredAnnotation ? 'cursor-pointer' : 
              'cursor-crosshair hover:border-skribble-azure/30'
            }`}
            onWheel={handleWheel}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ touchAction: 'none' }}
          />        
          {/* Enhanced Annotation Tooltip with Better Positioning */}
            {hoveredAnnotation && (
              <div
                className="absolute z-50 bg-skribble-dark/95 backdrop-blur-sm text-skribble-sky text-xs p-4 rounded-lg border border-skribble-azure/30 shadow-lg pointer-events-none max-w-sm"
                style={{
                  ...getTooltipPosition(hoveredAnnotation),
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                {/* Tooltip Arrow */}
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-skribble-dark/95"></div>
                
                {/* Header with user and timestamp */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Profile Image */}
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
                  
                  <span className="flex-shrink-0 font-medium">{hoveredAnnotation.user}</span>
                  <span className="text-skribble-purple">•</span>
                  <span className="font-mono text-xs">{formatRulerTime(hoveredAnnotation.timestamp)}</span>
                  <span 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getAnnotationColor(annotations.find(a => a.id === hoveredAnnotation.id)!) }}
                  ></span>
                </div>
                
                {/* Main comment text */}
                <div className="text-skribble-sky leading-relaxed mb-3">
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
                    {annotations.find(a => a.id === hoveredAnnotation.id)?.status && (
                      <>
                        <span className="text-skribble-azure">•</span>
                        <span className={`capitalize ${
                          annotations.find(a => a.id === hoveredAnnotation.id)?.status === 'pending' ? 'text-yellow-400' :
                          annotations.find(a => a.id === hoveredAnnotation.id)?.status === 'resolved' ? 'text-green-400' :
                          annotations.find(a => a.id === hoveredAnnotation.id)?.status === 'approved' ? 'text-blue-400' :
                          'text-skribble-azure'
                        }`}>
                          {annotations.find(a => a.id === hoveredAnnotation.id)?.status}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Click instruction */}
                  <span className="text-skribble-azure ml-2">Click to jump</span>
                </div>
                
                {/* Creation date */}
                {annotations.find(a => a.id === hoveredAnnotation.id)?.createdAt && (
                  <div className="text-xs text-skribble-purple/70 mt-2">
                    {new Date(annotations.find(a => a.id === hoveredAnnotation.id)!.createdAt).toLocaleDateString()} at {new Date(annotations.find(a => a.id === hoveredAnnotation.id)!.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            )}

          
          {/* Click Feedback Indicator */}
          {clickFeedback && (
            <div
              className="absolute pointer-events-none z-40"
              style={{
                left: clickFeedback.x - 20,
                top: CANVAS_HEIGHT / 2 - 20,
                width: 40,
                height: 40
              }}
            >
              <div className="w-full h-full rounded-full border-2 border-skribble-sky animate-ping"></div>
              <div className="absolute inset-2 rounded-full bg-skribble-sky/20 animate-pulse"></div>
            </div>
          )}
          
          {/* Enhanced Loading State */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-skribble-dark/50 rounded-lg backdrop-blur-sm">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-skribble-azure animate-spin mx-auto mb-2" />
                <p className="text-skribble-azure text-sm">Loading audio...</p>
              </div>
            </div>
          )}

          {/* Enhanced Error State */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-skribble-dark/50 rounded-lg backdrop-blur-sm">
              <div className="text-center max-w-sm px-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-red-400 text-xl">⚠️</span>
                </div>
                <p className="text-red-400 text-sm font-medium mb-2">Audio Error</p>
                <p className="text-red-300 text-xs">{error}</p>
                <button 
                  onClick={() => {
                    setError(null);
                    if (audioUrl && userInteracted) {
                      initializeAudio();
                    }
                  }}
                  className="mt-3 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Cursor Position Indicator */}
          {!isLoading && !error && (
            <div className="absolute bottom-2 right-2 text-xl text-skribble-azure font-mono bg-skribble-dark/20 rounded-lg px-2 py-1 rounded">
              {(() => {
              const ms = Math.floor((currentTime % 1) * 1000)
                .toString()
                .padStart(3, '0');
              return `${formatRulerTime(currentTime)}.${ms}`;
              })()}
            </div>
          )}
        </div>

        {/* Time Ruler */}
        <div className="relative h-8 mb-4">
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
            
          </div>
            {duration > 0 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-skribble-sky shadow-lg z-10"
                style={{
                  left: `${((currentTime - scrollOffset) / (duration / zoomLevel)) * 100}%`,
                  display: currentTime >= scrollOffset && currentTime <= scrollOffset + (duration / zoomLevel) ? 'block' : 'none'
                }}
              >
                <div className="absolute top-full mt-1 transform -translate-x-1/2">
                  <div className="bg-skribble-azure text-white text-xs px-1 py-0.5 rounded font-mono whitespace-nowrap">
                    {formatRulerTime(currentTime)}
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Controls */}
        <div className="flex mt-10 items-center justify-between">

          <div className="text-sm text-skribble-azure font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={skipBackward}
              className="w-12 h-12 bg-gradient-to-r bg-skribble-dark/20 rounded-lg from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none"
              disabled={isLoading || !isAudioReady}
            >
              <SkipBack className="w-5 h-5 text-white" />
            </button>
            
            <button
              onClick={togglePlayPause}
              className="w-12 h-12 bg-gradient-to-r bg-skribble-dark/20 rounded-lg from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none"
              disabled={isLoading || !isAudioReady || !userInteracted}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-1" />
              )}
            </button>
            
            <button
              onClick={skipForward}
              className="w-12 h-12 bg-gradient-to-r bg-skribble-dark/20 rounded-lg from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none"
              disabled={isLoading || !isAudioReady}
            >
              <SkipForward className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex items-center gap-2 bg-skribble-dark/20 rounded-lg">
            <button
              onClick={toggleMute}
              className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 bg-skribble-dark/20 rounded-lg" /> : <Volume2 className="w-4 h-4" />}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-20 h-1 bg-skribble-purple rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          {controlsSection}
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
              className="ml-4 border-l border-skribble-azure/20 pl-4 bg-skribble-dark/20 rounded-lg text-skribble-sky hover:text-skribble-sky"
            />
        <audio
          ref={audioRef}
          preload="metadata"
          crossOrigin="anonymous"
        />

        <style jsx>{`
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
          
          .slider::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #71A9F7;
            cursor: pointer;
            border: 2px solid #C6D8FF;
          }
          
          .slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #71A9F7;
            cursor: pointer;
            border: 2px solid #C6D8FF;
          }
        `}</style>
      </div>
      </div>

      {/* DAW Export Menu */}

      {/* Annotation System */}
      {showAnnotations && !isViewOnly && currentUser && (
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
        />
      )} 
      {/* Version Control */}
        {showVersionControl && (
          <div className="mt-6">
            <VersionControl
              projectId={projectId}
              currentUser={currentUser}
              onVersionChange={onVersionChange || (() => {})} // 🔑 Pass the prop through
              onError={handleVersionError}
            />
          </div>
        )}
    </div>
  );

}