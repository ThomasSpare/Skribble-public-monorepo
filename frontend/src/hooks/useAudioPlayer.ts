// frontend/src/hooks/useAudioPlayer.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { loadAndDecodeAudio, generateWaveform, AudioMetadata } from '@/lib/audioUtils';

export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  waveformData: number[];
  metadata: AudioMetadata | null;
  error: string | null;
}

export interface AudioPlayerControls {
  play: () => Promise<void>;
  pause: () => void;
  togglePlayPause: () => Promise<void>;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  skipBackward: (seconds?: number) => void;
  skipForward: (seconds?: number) => void;
  loadAudio: (url: string) => Promise<void>;
  reset: () => void;
}

export interface UseAudioPlayerOptions {
  onTimeUpdate?: (currentTime: number) => void;
  onLoadComplete?: (duration: number, metadata: AudioMetadata) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onError?: (error: string) => void;
  autoPlay?: boolean;
  preload?: boolean;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const {
    onTimeUpdate,
    onLoadComplete,
    onPlayStateChange,
    onError,
    autoPlay = false,
    preload = true
  } = options;

  // State
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: false,
    duration: 0,
    currentTime: 0,
    volume: 0.8,
    isMuted: false,
    waveformData: [],
    metadata: null,
    error: null
  });

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousVolumeRef = useRef<number>(0.8);

  // Initialize audio context
  const initializeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume context if suspended
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  // Setup Web Audio API nodes
  const setupWebAudio = useCallback(async () => {
    if (!audioRef.current || sourceRef.current) return;

    const audioContext = await initializeAudioContext();
    
    try {
      sourceRef.current = audioContext.createMediaElementSource(audioRef.current);
      analyserRef.current = audioContext.createAnalyser();
      
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContext.destination);
    } catch (error) {
      console.error('Error setting up Web Audio:', error);
    }
  }, [initializeAudioContext]);

  // Generate waveform data
  const generateWaveformData = useCallback(async (audioUrl: string) => {
    try {
      const audioContext = await initializeAudioContext();
      const audioBuffer = await loadAndDecodeAudio(audioContext, audioUrl);
      const waveform = await generateWaveform(audioBuffer, 1000);
      
      const metadata: AudioMetadata = {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        format: 'decoded'
      };

      setState(prev => ({
        ...prev,
        waveformData: waveform,
        metadata,
        duration: audioBuffer.duration
      }));

      onLoadComplete?.(audioBuffer.duration, metadata);
    } catch (error) {
      console.error('Error generating waveform:', error);
      // Generate fallback waveform
      const fallbackWaveform = Array.from({ length: 1000 }, () => Math.random() * 0.5 + 0.25);
      setState(prev => ({
        ...prev,
        waveformData: fallbackWaveform,
        error: 'Failed to generate waveform, using fallback'
      }));
    }
  }, [initializeAudioContext, onLoadComplete]);

  // Load audio file
  const loadAudio = useCallback(async (url: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Create audio element if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.crossOrigin = 'anonymous';
        audioRef.current.preload = preload ? 'metadata' : 'none';
      }

      // Set up event listeners
      const audio = audioRef.current;
      
      const handleLoadedMetadata = () => {
        setState(prev => ({
          ...prev,
          duration: audio.duration,
          isLoading: false
        }));
      };

      const handleTimeUpdate = () => {
        const currentTime = audio.currentTime;
        setState(prev => ({ ...prev, currentTime }));
        onTimeUpdate?.(currentTime);
      };

      const handleEnded = () => {
        setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
        onPlayStateChange?.(false);
      };

      const handleError = (e: Event) => {
        const errorMessage = 'Failed to load audio file';
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: errorMessage 
        }));
        onError?.(errorMessage);
      };

      const handleCanPlay = async () => {
        await setupWebAudio();
        if (autoPlay) {
          await play();
        }
      };

      // Remove existing listeners
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);

      // Add new listeners
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      audio.addEventListener('canplay', handleCanPlay);

      // Set source and load
      audio.src = url;
      audio.volume = state.volume;
      audio.muted = state.isMuted;

      // Generate waveform data
      await generateWaveformData(url);

    } catch (error) {
      const errorMessage = 'Failed to load audio';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      onError?.(errorMessage);
    }
  }, [preload, autoPlay, setupWebAudio, generateWaveformData, state.volume, state.isMuted, onTimeUpdate, onPlayStateChange, onError]);

  // Play audio
  const play = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      await initializeAudioContext();
      await audioRef.current.play();
      setState(prev => ({ ...prev, isPlaying: true, error: null }));
      onPlayStateChange?.(true);
    } catch (error) {
      console.error('Error playing audio:', error);
      const errorMessage = 'Failed to play audio';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [initializeAudioContext, onPlayStateChange, onError]);

  // Pause audio
  const pause = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
    onPlayStateChange?.(false);
  }, [onPlayStateChange]);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (state.isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [state.isPlaying, play, pause]);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;

    const clampedTime = Math.max(0, Math.min(time, state.duration));
    audioRef.current.currentTime = clampedTime;
    setState(prev => ({ ...prev, currentTime: clampedTime }));
  }, [state.duration]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    
    setState(prev => ({ ...prev, volume: clampedVolume }));
    previousVolumeRef.current = clampedVolume;
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMutedState = !state.isMuted;
    
    if (audioRef.current) {
      audioRef.current.muted = newMutedState;
    }

    setState(prev => ({ ...prev, isMuted: newMutedState }));
  }, [state.isMuted]);

  // Skip backward
  const skipBackward = useCallback((seconds: number = 10) => {
    seekTo(state.currentTime - seconds);
  }, [state.currentTime, seekTo]);

  // Skip forward
  const skipForward = useCallback((seconds: number = 10) => {
    seekTo(state.currentTime + seconds);
  }, [state.currentTime, seekTo]);

  // Reset player
  const reset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setState({
      isPlaying: false,
      isLoading: false,
      duration: 0,
      currentTime: 0,
      volume: 0.8,
      isMuted: false,
      waveformData: [],
      metadata: null,
      error: null
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Return state and controls
  const controls: AudioPlayerControls = {
    play,
    pause,
    togglePlayPause,
    seekTo,
    setVolume,
    toggleMute,
    skipBackward,
    skipForward,
    loadAudio,
    reset
  };

  return {
    ...state,
    ...controls,
    audioElement: audioRef.current,
    audioContext: audioContextRef.current,
    analyser: analyserRef.current
  };
}

// Keyboard shortcuts hook for audio player
export function useAudioKeyboard(controls: AudioPlayerControls, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          controls.togglePlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          controls.skipBackward(event.shiftKey ? 30 : 10);
          break;
        case 'ArrowRight':
          event.preventDefault();
          controls.skipForward(event.shiftKey ? 30 : 10);
          break;
        case 'ArrowUp':
          event.preventDefault();
          // Increase volume (you'd need to track current volume)
          break;
        case 'ArrowDown':
          event.preventDefault();
          // Decrease volume
          break;
        case 'KeyM':
          event.preventDefault();
          controls.toggleMute();
          break;
        case 'Home':
          event.preventDefault();
          controls.seekTo(0);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [controls, enabled]);
}

// Hook for real-time audio analysis (for visualizations)
export function useAudioAnalysis(
  analyser: AnalyserNode | null, 
  isPlaying: boolean,
  onAnalysis?: (frequencyData: Uint8Array, timeData: Uint8Array) => void
) {
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    const analyze = () => {
      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(timeData);
      
      onAnalysis?.(frequencyData, timeData);
      
      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isPlaying, onAnalysis]);
}