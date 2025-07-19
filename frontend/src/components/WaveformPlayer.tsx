import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, Download, ZoomIn, ZoomOut, Home } from 'lucide-react';

interface WaveformPlayerProps {
  audioUrl: string;
  title?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadComplete?: (duration: number) => void;
  annotations?: Array<{
    id: string;
    timestamp: number;
    text: string;
    user: { username: string };
    type: 'comment' | 'marker' | 'issue';
  }>;
}

export default function EnhancedWaveformPlayer({ 
  audioUrl, 
  title = "Audio Track",
  onTimeUpdate,
  onLoadComplete,
  annotations = []
}: WaveformPlayerProps) {
  // State management
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

  const [lastCursorPosition, setLastCursorPosition] = useState(0);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [shouldResumeFromCursor, setShouldResumeFromCursor] = useState(false);

  // Zoom and scroll state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, offset: 0 });

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Constants
  const CANVAS_HEIGHT = 120;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 10;

  // Enable audio on any user interaction
  useEffect(() => {
    const enableAudio = () => {
      setUserInteracted(true);
      
      // Try to initialize audio context immediately
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (error) {
          console.error('Failed to create audio context:', error);
        }
      }
    };

    // Listen for various user interactions
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, enableAudio, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, enableAudio);
      });
    };
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

  // Initialize audio and generate waveform
  const initializeAudio = async () => {
    
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
      
      // Reset audio element
      audio.pause();
      audio.currentTime = 0;
      
      // Set up audio element properties
      audio.crossOrigin = "anonymous";
      audio.preload = "metadata";
      audio.volume = volume;
      audio.muted = isMuted;

      // Create promise-based event listeners
      const audioLoadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio loading timeout'));
        }, 15000); // 15 second timeout

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
          reject(new Error(`Audio loading failed: ${audio.error?.message || 'Unknown error'}`));
        };

        // Add event listeners
        audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
        audio.addEventListener('error', onError, { once: true });
        
        // Clean up function
        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', onLoadedMetadata);
          audio.removeEventListener('canplaythrough', onCanPlayThrough);
          audio.removeEventListener('error', onError);
        };

        // Store cleanup for later use
        (resolve as any).cleanup = cleanup;
        (reject as any).cleanup = cleanup;
      });

      // Set source and load
      audio.src = audioUrl;
      audio.load();

      // Wait for audio to load
      await audioLoadPromise;

      // Set up Web Audio API for visualization (optional, don't let it block playback)
      try {
        await setupWebAudio();
      } catch (webAudioError) {
        console.warn('Web Audio API setup failed, but basic playback should still work:', webAudioError);
      }

      // Generate waveform data
      await generateWaveform();
      
    } catch (error) {
      console.error('Error initializing audio:', error);
      setError(`Waveform generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setIsGeneratingWaveform(false);
    }
  };

  // Setup Web Audio API nodes
  const setupWebAudio = async () => {
    if (!audioRef.current || sourceRef.current) return;

    try {
      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // Resume context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create source and analyser
      sourceRef.current = audioContext.createMediaElementSource(audioRef.current);
      analyserRef.current = audioContext.createAnalyser();
      
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      // Connect nodes
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContext.destination);
      
    } catch (error) {
      console.error('Web Audio API setup failed:', error);
      throw error;
    }
  };

  // Generate waveform data from audio file
  const generateWaveform = async () => {
    if (!userInteracted) {
      return;
    }

    try {      
      // Create temporary audio context for decoding
      const tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);  
      
      // Use the decoded duration as the authoritative source
      const actualDuration = audioBuffer.duration;
      setDuration(actualDuration);
      onLoadComplete?.(actualDuration);
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = Math.floor(actualDuration * 50); // 50 samples per second
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
      
      // Normalize waveform
      const max = Math.max(...waveform);
      const normalizedWaveform = max > 0 ? waveform.map(sample => sample / max) : waveform;
      
      setWaveformData(normalizedWaveform);
      
      // Close temporary context
      await tempAudioContext.close();
      
    } catch (error) {
      console.error('Error generating waveform:', error);
      // Create fallback waveform
      const fallbackDuration = audioRef.current?.duration || 180; // 3 minutes default
      const fallbackSamples = Math.floor(fallbackDuration * 50);
      const fallback = Array.from({ length: fallbackSamples }, () => Math.random() * 0.5 + 0.25);
      setWaveformData(fallback);
      setDuration(fallbackDuration);
    }
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

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', audio.error, e);
      setError(`Playback error: ${audio.error?.message || 'Unknown error'}`);
      setIsPlaying(false);
    };

    // Add all event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('error', handleError);
    
    return () => {
      // Clean up event listeners
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('error', handleError);
    };
  }, [onTimeUpdate]);

  // Calculate visible waveform based on zoom and scroll
  const getVisibleWaveform = useCallback(() => {
    if (waveformData.length === 0 || duration === 0) return [];
    
    const samplesPerSecond = waveformData.length / duration;
    const visibleDuration = duration / zoomLevel;
    const startTime = scrollOffset;
    const endTime = Math.min(startTime + visibleDuration, duration);
    
    const startIndex = Math.floor(startTime * samplesPerSecond);
    const endIndex = Math.min(Math.ceil(endTime * samplesPerSecond), waveformData.length);
    
    return waveformData.slice(startIndex, endIndex);
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

  // Draw waveform on canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const visibleWaveform = getVisibleWaveform();
    const visibleDuration = duration / zoomLevel;
    const progress = duration > 0 ? (currentTime - scrollOffset) / visibleDuration : 0;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    drawGrid(ctx, width, height, visibleDuration);
    
    // Draw waveform
    if (visibleWaveform.length > 0) {
      const barWidth = width / visibleWaveform.length;
      const centerY = height / 2;
      
      visibleWaveform.forEach((sample, i) => {
        const barHeight = sample * height * 0.7;
        const x = i * barWidth;
        const y = centerY - barHeight / 2;
        
        const barProgress = i / visibleWaveform.length;
        if (barProgress <= progress && currentTime >= scrollOffset && currentTime <= scrollOffset + visibleDuration) {
          ctx.fillStyle = '#71A9F7';
        } else {
          ctx.fillStyle = '#6B5CA5';
        }
        
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      });
    }
    
    // Draw annotations
    drawAnnotations(ctx, width, height, visibleDuration);
    
    // Draw current time indicator
    if (currentTime >= scrollOffset && currentTime <= scrollOffset + visibleDuration) {
      const progressX = progress * width;
      ctx.strokeStyle = '#C6D8FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();
    }
    
  }, [waveformData, currentTime, duration, annotations, zoomLevel, scrollOffset, getVisibleWaveform]);

  // Draw grid lines
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, visibleDuration: number) => {
    ctx.strokeStyle = 'rgba(198, 216, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridSpacing = Math.max(20, width / (visibleDuration / 5));
    
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    const horizontalLines = 5;
    for (let i = 1; i < horizontalLines; i++) {
      const y = (height / horizontalLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Draw chat bubble annotations
  const drawAnnotations = (ctx: CanvasRenderingContext2D, width: number, height: number, visibleDuration: number) => {
    const visibleStart = scrollOffset;
    const visibleEnd = scrollOffset + visibleDuration;
    
    annotations.forEach(annotation => {
      if (annotation.timestamp >= visibleStart && annotation.timestamp <= visibleEnd) {
        const x = ((annotation.timestamp - visibleStart) / visibleDuration) * width;
        
        const bubbleWidth = 24;
        const bubbleHeight = 20;
        const bubbleX = x - bubbleWidth / 2;
        const bubbleY = 5;
        
        const bubbleColor = annotation.type === 'issue' ? '#ef4444' : 
                           annotation.type === 'marker' ? '#f59e0b' : '#71A9F7';
        
        ctx.fillStyle = bubbleColor;
        
        // Draw rounded rectangle
        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8);
        ctx.fill();
        
        // Draw bubble tail
        ctx.beginPath();
        ctx.moveTo(x - 4, bubbleY + bubbleHeight);
        ctx.lineTo(x, bubbleY + bubbleHeight + 6);
        ctx.lineTo(x + 4, bubbleY + bubbleHeight);
        ctx.closePath();
        ctx.fill();
        
        // Draw dots
        ctx.fillStyle = 'white';
        const dotSize = 2;
        const dotSpacing = 5;
        const startDotX = x - (dotSpacing);
        const dotY = bubbleY + bubbleHeight / 2;
        
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(startDotX + (i * dotSpacing), dotY, dotSize, 0, 2 * Math.PI);
          ctx.fill();
        }
        
        // Draw vertical line
        ctx.strokeStyle = bubbleColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x, bubbleY + bubbleHeight + 6);
        ctx.lineTo(x, height - 5);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
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
      
      setZoomLevel(newZoomLevel);
      setScrollOffset(newScrollOffset);
    }
  }, [zoomLevel, scrollOffset, duration]);

  // Handle canvas click for seeking
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / canvas.width;
    const visibleDuration = duration / zoomLevel;
    const newTime = scrollOffset + (progress * visibleDuration);
    
    seekTo(newTime);
  };

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

  // Playback controls
  const togglePlayPause = async () => {
    if (!audioRef.current || !isAudioReady) {
      console.warn('Audio not ready for playback');
      return;
    }

    const audio = audioRef.current;

    try {
      // Ensure audio context is running
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (isPlaying) {
        audio.pause();
      } else {
        // Ensure audio is loaded and ready
        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
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

  const seekTo = (time: number) => {
    if (!audioRef.current || !isAudioReady) return;
    
    const audio = audioRef.current;
    const clampedTime = Math.max(0, Math.min(time, duration));
    audio.currentTime = clampedTime;
  };

  const skipBackward = () => seekTo(currentTime - 10);
  const skipForward = () => seekTo(currentTime + 10);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

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

  return (
    <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-madimi text-lg text-skribble-sky">{title}</h3>
        <div className="flex items-center gap-2">
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
          
          {/* Zoom Controls */}
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

      {/* Waveform Canvas */}
      <div 
        ref={waveformContainerRef}
        className="relative mb-4"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={CANVAS_HEIGHT}
          className="w-full bg-skribble-dark/30 rounded-lg border border-skribble-azure/10"
          onWheel={handleWheel}
          onClick={handleCanvasClick}
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none'
          }}
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-skribble-dark/50 rounded-lg">
            <Loader2 className="w-6 h-6 text-skribble-azure animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-skribble-dark/50 rounded-lg">
            <p className="text-red-400 text-sm text-center px-4">{error}</p>
          </div>
        )}
      </div>

      {/* Time Ruler */}
      <div className="relative h-8 mb-4">
        <div className="absolute inset-0 bg-skribble-dark/20 rounded border-t border-skribble-azure/10">
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
          
          {/* Current time indicator */}
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
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={skipBackward}
            className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors"
            disabled={isLoading || !isAudioReady}
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          <button
            onClick={togglePlayPause}
            className="w-12 h-12 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none"
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
            className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors"
            disabled={isLoading || !isAudioReady}
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Time Display */}
        <div className="text-sm text-skribble-azure font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors"
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
            className="w-20 h-1 bg-skribble-purple rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
      />

      <style jsx>{`
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
  );
}