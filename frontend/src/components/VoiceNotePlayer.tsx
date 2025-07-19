// VoiceNotePlayer.tsx
'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoiceNotePlayerProps {
  voiceNoteUrl: string;
  annotation: any;
  onSeekTo: (timestamp: number) => void;
  className?: string;
}

export default function VoiceNotePlayer({ 
  voiceNoteUrl, 
  annotation, 
  onSeekTo, 
  className = '' 
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(() => new Audio(voiceNoteUrl));
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
      setError(null);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError('Failed to load voice note');
      setIsLoaded(false);
    };

    const handleCanPlay = () => {
      setIsLoaded(true);
      setError(null);
    };

    // Set up event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    // Preload audio
    audio.preload = 'metadata';
    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [audio]);

  const togglePlay = useCallback(async () => {
    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing voice note:', error);
      setError('Playback failed');
      setIsPlaying(false);
    }
  }, [audio, isPlaying]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLoaded || duration === 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const clickTime = (x / width) * duration;
    
    audio.currentTime = clickTime;
    setCurrentTime(clickTime);
  }, [audio, duration, isLoaded]);

  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatAnnotationTime = useCallback((timestamp: number): string => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  if (error) {
    return (
      <div className={`bg-red-500/20 border border-red-500/40 rounded-lg p-3 mt-2 ${className}`}>
        <div className="flex items-center gap-2 text-red-200 text-sm">
          <span>🎤</span>
          <span>Voice note unavailable: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-skribble-dark-plum/30 rounded-lg p-3 mt-2 ${className}`}>
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          className="flex items-center justify-center w-8 h-8 bg-skribble-azure hover:bg-skribble-azure/80 
                   disabled:bg-skribble-azure/50 disabled:cursor-not-allowed
                   rounded-full transition-colors"
          title={isPlaying ? 'Pause voice note' : 'Play voice note'}
        >
          {!isLoaded ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" />
          )}
        </button>
        
        {/* Progress and Info */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-skribble-azure/60 mb-1">
            <span className="flex items-center gap-1">
              <span>🎤</span>
              <span>Voice Note</span>
              {annotation.user?.username && (
                <span className="text-skribble-azure/40">by {annotation.user.username}</span>
              )}
            </span>
            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div 
            className="w-full bg-skribble-dark-plum/50 rounded-full h-2 cursor-pointer hover:h-2.5 transition-all"
            onClick={handleProgressClick}
            title="Click to seek"
          >
            <div 
              className="bg-skribble-azure h-full rounded-full transition-all duration-100 relative"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
            >
              {/* Playhead indicator */}
              {isPlaying && (
                <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
              )}
            </div>
          </div>
        </div>
        
        {/* Timestamp Link */}
        <button
          onClick={() => onSeekTo(annotation.timestamp)}
          className="text-skribble-azure/60 hover:text-skribble-azure text-xs px-2 py-1 
                   rounded hover:bg-skribble-azure/10 transition-colors"
          title="Go to annotation timestamp in main audio"
        >
          @{formatAnnotationTime(annotation.timestamp)}
        </button>
      </div>

      {/* Additional Info */}
      {annotation.priority && annotation.priority !== 'medium' && (
        <div className="mt-2 text-xs">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
            annotation.priority === 'critical' ? 'bg-red-500/20 text-red-200' :
            annotation.priority === 'high' ? 'bg-orange-500/20 text-orange-200' :
            annotation.priority === 'low' ? 'bg-green-500/20 text-green-200' :
            'bg-skribble-azure/20 text-skribble-azure'
          }`}>
            {annotation.priority === 'critical' && '🔥'}
            {annotation.priority === 'high' && '⚡'}
            {annotation.priority === 'low' && '✅'}
            {annotation.priority} priority
          </span>
        </div>
      )}
    </div>
  );
}