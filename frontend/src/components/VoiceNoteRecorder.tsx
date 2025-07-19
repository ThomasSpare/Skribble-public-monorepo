// VoiceNoteRecorder.tsx
'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  Upload,
  Loader2,
  Volume2 
} from 'lucide-react';

interface VoiceNoteRecorderProps {
  onVoiceNoteCreated: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  isRecording?: boolean;
  maxDuration?: number; // in seconds, default 120 (2 minutes)
  className?: string;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

export default function VoiceNoteRecorder({
  onVoiceNoteCreated,
  onCancel,
  maxDuration = 120,
  className = ''
}: VoiceNoteRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Initialize audio context for better mobile compatibility
  const initializeRecording = useCallback(async () => {
    try {
      setPermissionError(null);
      
      // Request microphone permission with optimal settings for mobile
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1, // Mono for smaller file size
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Mobile-specific optimizations
          ...(navigator.userAgent.includes('Mobile') && {
            sampleRate: 22050, // Lower sample rate for mobile
            sampleSize: 16
          })
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Use webm for better mobile compatibility, fallback to mp4
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/mpeg',
        'audio/wav'
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported audio format found');
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000 // Good quality but manageable file size
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: selectedMimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setRecordingState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          isRecording: false,
          isPaused: false
        }));
      };

      mediaRecorderRef.current = mediaRecorder;
      return true;
    } catch (error) {
      console.error('Failed to initialize recording:', error);
      let errorMessage = 'Failed to access microphone';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Microphone permission denied. Please allow microphone access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please check your device settings.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Audio recording not supported on this device.';
        }
      }
      
      setPermissionError(errorMessage);
      return false;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    const initialized = await initializeRecording();
    if (!initialized || !mediaRecorderRef.current) return;

    mediaRecorderRef.current.start(1000); // Collect data every second
    setRecordingState(prev => ({ ...prev, isRecording: true, duration: 0 }));

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingState(prev => {
        const newDuration = prev.duration + 1;
        
        // Auto-stop at max duration
        if (newDuration >= maxDuration) {
          stopRecording();
          return { ...prev, duration: maxDuration };
        }
        
        return { ...prev, duration: newDuration };
      });
    }, 1000);
  }, [initializeRecording, maxDuration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [recordingState.isRecording]);

  // Preview playback
  const togglePreview = useCallback(() => {
    if (!recordingState.audioUrl) return;

    if (isPlayingPreview) {
      audioRef.current?.pause();
      setIsPlayingPreview(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(recordingState.audioUrl);
        audioRef.current.addEventListener('ended', () => setIsPlayingPreview(false));
      }
      audioRef.current.play();
      setIsPlayingPreview(true);
    }
  }, [recordingState.audioUrl, isPlayingPreview]);

  // Delete recording
  const deleteRecording = useCallback(() => {
    if (recordingState.audioUrl) {
      URL.revokeObjectURL(recordingState.audioUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setRecordingState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null
    });
    setIsPlayingPreview(false);
  }, [recordingState.audioUrl]);

  // Upload voice note
  const uploadVoiceNote = useCallback(async () => {
    if (!recordingState.audioBlob) return;

    setIsUploading(true);
    try {
      await onVoiceNoteCreated(recordingState.audioBlob, recordingState.duration);
    } catch (error) {
      console.error('Failed to upload voice note:', error);
      // Error handling should be done by parent component
    } finally {
      setIsUploading(false);
    }
  }, [recordingState.audioBlob, recordingState.duration, onVoiceNoteCreated]);

  // Format time display
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingState.audioUrl) {
        URL.revokeObjectURL(recordingState.audioUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [recordingState.audioUrl]);

  return (
    <div className={`bg-skribble-plum/30 backdrop-blur-md rounded-xl border border-skribble-azure/20 p-4 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Mic className="w-5 h-5 text-skribble-azure" />
            Voice Note
          </h3>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg text-skribble-azure/60 hover:text-skribble-azure transition-colors"
            title="Cancel"
          >
            ×
          </button>
        </div>

        {/* Permission Error */}
        {permissionError && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3">
            <p className="text-red-200 text-sm">{permissionError}</p>
          </div>
        )}

        {/* Recording Status */}
        <div className="text-center">
          <div className="text-2xl font-mono text-white mb-2">
            {formatTime(recordingState.duration)}
          </div>
          {maxDuration > 0 && (
            <div className="text-sm text-skribble-azure/60">
              Max: {formatTime(maxDuration)}
            </div>
          )}
        </div>

        {/* Recording Progress Bar */}
        {recordingState.isRecording && (
          <div className="w-full bg-skribble-dark-plum/50 rounded-full h-2">
            <div 
              className="bg-red-400 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${(recordingState.duration / maxDuration) * 100}%` }}
            />
          </div>
        )}

        {/* Recording Controls */}
        <div className="flex justify-center gap-3">
          {!recordingState.audioBlob ? (
            // Recording controls
            <>
              {!recordingState.isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={!!permissionError}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 
                           disabled:bg-red-500/50 disabled:cursor-not-allowed
                           text-white rounded-lg transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 
                           text-white rounded-lg transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              )}
            </>
          ) : (
            // Preview controls
            <>
              <button
                onClick={togglePreview}
                className="flex items-center gap-2 px-4 py-2 bg-skribble-azure hover:bg-skribble-azure/80 
                         text-white rounded-lg transition-colors"
              >
                {isPlayingPreview ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Preview
                  </>
                )}
              </button>
              
              <button
                onClick={deleteRecording}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 
                         text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              
              <button
                onClick={uploadVoiceNote}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 
                         disabled:bg-green-500/50 disabled:cursor-not-allowed
                         text-white rounded-lg transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Use Recording
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Recording indicator */}
        {recordingState.isRecording && (
          <div className="flex items-center justify-center gap-2 text-red-400">
            <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording...</span>
          </div>
        )}

        {/* Mobile optimization tip */}
        <div className="text-xs text-skribble-azure/50 text-center">
          💡 For best quality, hold your device close to your mouth
        </div>
      </div>
    </div>
  );
}