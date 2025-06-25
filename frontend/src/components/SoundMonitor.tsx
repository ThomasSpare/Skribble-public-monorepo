// SoundMonitor.tsx - Improved version with better key detection and no tempo detection
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Activity, Music, Eye, EyeOff } from 'lucide-react';

interface SoundMonitorProps {
  analyser?: AnalyserNode | null;
  isPlaying?: boolean;
  onKeyDetected?: (key: string, confidence: number) => void;
  onVolumeWarning?: (channel: 'L' | 'R', level: number) => void;
  audioBuffer?: AudioBuffer | null;
  currentTime?: number;
}

interface KeyAnalysis {
  key: string;
  confidence: number;
  lastUpdate: number;
}

interface StereoLevels {
  L: { rms: number; peak: number };
  R: { rms: number; peak: number };
}

// Enhanced note frequencies covering more octaves for better detection
const noteFrequencies: { [key: string]: number } = {
  'C': 261.63,
  'C#': 277.18,
  'D': 293.66,
  'D#': 311.13,
  'E': 329.63,
  'F': 349.23,
  'F#': 369.99,
  'G': 392.00,
  'G#': 415.30,
  'A': 440.00,
  'A#': 466.16,
  'B': 493.88
};

// Add multiple octaves for better detection
const extendedNoteFrequencies: { [key: string]: number[] } = {};
Object.entries(noteFrequencies).forEach(([note, baseFreq]) => {
  extendedNoteFrequencies[note] = [
    baseFreq / 4,    // Two octaves down
    baseFreq / 2,    // One octave down  
    baseFreq,        // Base frequency
    baseFreq * 2,    // One octave up
    baseFreq * 4     // Two octaves up
  ];
});

export default function SoundMonitor({
  analyser,
  isPlaying,
  onKeyDetected,
  onVolumeWarning,
  currentTime = 0
}: SoundMonitorProps) {
  // State
  const [isVisible, setIsVisible] = useState(true); 
  const [meterGain, setMeterGain] = useState(1);
  const [meterMode, setMeterMode] = useState<'peak' | 'rms' | 'both'>('both');
  const [holdPeaks, setHoldPeaks] = useState(true);
  const [volumeWarnings, setVolumeWarnings] = useState({ L: false, R: false });
  const [detectedKey, setDetectedKey] = useState<KeyAnalysis>({ key: '', confidence: 0, lastUpdate: 0 });
  const [currentLevels, setCurrentLevels] = useState<StereoLevels>({ 
    L: { rms: 0, peak: 0 }, 
    R: { rms: 0, peak: 0 } 
  });
  const [peakHolds, setPeakHolds] = useState({ L: 0, R: 0 });

  // Refs for analysis
  const animationFrameRef = useRef<number | null>(null);
  const frequencyHistoryRef = useRef<Uint8Array[]>([]);
  const keyHistoryRef = useRef<{ key: string; confidence: number; timestamp: number }[]>([]);
  const lastKeyUpdateRef = useRef<number>(0);
  const peakHoldTimeoutRef = useRef<{ L?: NodeJS.Timeout; R?: NodeJS.Timeout }>({});

  // Constants
  const KEY_UPDATE_INTERVAL = 250; // Update every 250ms (more frequent)
  const VOLUME_WARNING_THRESHOLD = 0.95;

  // Start/stop analysis based on playback state
  useEffect(() => {
    if (isPlaying && analyser) {
      startAnalysis();
    } else {
      stopAnalysis();
    }

    return () => {
      stopAnalysis();
      // Cleanup peak hold timeouts
      Object.values(peakHoldTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [isPlaying, analyser]);

  // Component to render segmented meter like a mixing board
  const SegmentedMeter = ({ level, peakHold, isWarning, channel }: { 
  level: { rms: number; peak: number }, 
  peakHold: number, 
  isWarning: boolean,
  channel: 'L' | 'R' 
}) => {
  const segments = 20;
  const segmentHeight = 3;
  const segmentGap = 1;
  
  // Calculate active segments based on meter mode
  let activeLevel = 0;
  switch (meterMode) {
    case 'rms':
      activeLevel = level.rms * meterGain;
      break;
    case 'peak':
      activeLevel = level.peak * meterGain;
      break;
    case 'both':
    default:
      activeLevel = Math.max(level.rms, level.peak) * meterGain;
      break;
  }
  
  const activeSegments = Math.floor(Math.min(activeLevel * segments, segments));
  const peakSegment = Math.floor(Math.min(peakHold * segments, segments));

  return (
    <div className="flex flex-col-reverse space-y-reverse space-y-1 h-20">
      {Array.from({ length: segments }, (_, i) => {
        const isActive = i < activeSegments;
        const isPeakHold = holdPeaks && i === peakSegment - 1 && peakSegment > activeSegments;
        const isRedZone = i >= segments * 0.8;
        const isYellowZone = i >= segments * 0.6;
        
        let colorClass = 'bg-gray-700'; // Default inactive
        
        if (isActive || isPeakHold) {
          if (isRedZone) {
            colorClass = isWarning ? 'bg-red-500 animate-pulse' : 'bg-red-400';
          } else if (isYellowZone) {
            colorClass = 'bg-yellow-400';
          } else {
            colorClass = 'bg-green-400';
          }
        }

        // Peak hold gets special styling
        if (isPeakHold && !isActive) {
          colorClass += ' opacity-80';
        }

        return (
          <div
            key={i}
            className={`w-6 h-1 ${colorClass} transition-all duration-100 ${
              isActive || isPeakHold ? 'opacity-100' : 'opacity-20'
            } ${isPeakHold ? 'shadow-sm' : ''}`}
            style={{ 
              height: `${segmentHeight}px`,
              marginBottom: `${segmentGap}px`
            }}
          />
        );
      })}
    </div>
  );
};

  const startAnalysis = useCallback(() => {
    if (animationFrameRef.current) return; // Already running

    const analyzeAudio = () => {
      if (!analyser) return;

      // Make meters more responsive
      analyser.smoothingTimeConstant = 0.2; // More responsive than default 0.8

      // Get frequency and time domain data
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Uint8Array(analyser.fftSize);
      
      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(timeData);

      // Calculate volume levels (now showing identical L/R for accurate representation)
      const stereoLevels = calculateStereoLevels(timeData);
      setCurrentLevels(stereoLevels);
      
      // Update peak holds
      if (holdPeaks) {
        setPeakHolds(prev => {
          const newHolds = { ...prev };
          
          if (stereoLevels.L.peak > prev.L) {
            newHolds.L = stereoLevels.L.peak;
            if (peakHoldTimeoutRef.current.L) clearTimeout(peakHoldTimeoutRef.current.L);
            peakHoldTimeoutRef.current.L = setTimeout(() => {
              setPeakHolds(p => ({ ...p, L: 0 }));
            }, 1500);
          }
          
          if (stereoLevels.R.peak > prev.R) {
            newHolds.R = stereoLevels.R.peak;
            if (peakHoldTimeoutRef.current.R) clearTimeout(peakHoldTimeoutRef.current.R);
            peakHoldTimeoutRef.current.R = setTimeout(() => {
              setPeakHolds(p => ({ ...p, R: 0 }));
            }, 1500);
          }
          
          return newHolds;
        });
      }
      
      // Check for volume warnings
      const newWarnings = {
        L: stereoLevels.L.peak > VOLUME_WARNING_THRESHOLD,
        R: stereoLevels.R.peak > VOLUME_WARNING_THRESHOLD
      };

      if (newWarnings.L && !volumeWarnings.L) {
        onVolumeWarning?.('L', stereoLevels.L.peak);
      }
      if (newWarnings.R && !volumeWarnings.R) {
        onVolumeWarning?.('R', stereoLevels.R.peak);
      }

      setVolumeWarnings(newWarnings);

      // Store frequency history for key analysis
      frequencyHistoryRef.current.push(Uint8Array.from(frequencyData));

      // Keep only recent data (last 5 seconds worth for more responsive detection)
      const maxHistoryLength = 60 * 5; // assuming 60fps
      if (frequencyHistoryRef.current.length > maxHistoryLength) {
        frequencyHistoryRef.current = frequencyHistoryRef.current.slice(-maxHistoryLength);
      }

      // Analyze key more frequently
      const now = Date.now();
      if (now - lastKeyUpdateRef.current > KEY_UPDATE_INTERVAL) {
        analyzeKeyImproved(frequencyData);
        lastKeyUpdateRef.current = now;
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };

    analyzeAudio();
  }, [analyser, isPlaying, meterGain, meterMode, holdPeaks, volumeWarnings, onVolumeWarning]);

  const stopAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const calculateStereoLevels = (timeData: Uint8Array): StereoLevels => {
    // Simplified approach: For most music, both channels have similar content
    // We'll use the main analyser data and apply slight variations for visual distinction
    // This is more accurate than arbitrarily splitting the buffer
    
    let sum = 0, peak = 0;
    const length = timeData.length;

    // Calculate overall levels from the time domain data
    for (let i = 0; i < length; i++) {
      const sample = (timeData[i] - 128) / 128;
      const abs = Math.abs(sample);
      sum += abs * abs;
      peak = Math.max(peak, abs);
    }

    const rms = Math.sqrt(sum / length) * meterGain;
    const peakLevel = peak * meterGain;

    // For stereo display, we'll show the same levels for both channels
    // since we can't properly separate them without access to the audio source
    // This is more accurate than showing fake differences
    return {
      L: { rms, peak: peakLevel },
      R: { rms, peak: peakLevel }
    };
  };

  // Improved key detection with multiple techniques
  const analyzeKeyImproved = (frequencyData: Uint8Array) => {
    if (!analyser) return;

    const sampleRate = analyser.context.sampleRate;
    const nyquist = sampleRate / 2;
    const binSize = nyquist / frequencyData.length;
    
    // Method 1: Enhanced harmonic analysis with multiple octaves
    const noteEnergies: { [key: string]: number } = {};
    
    Object.entries(extendedNoteFrequencies).forEach(([note, frequencies]) => {
      let totalEnergy = 0;
      let harmonicCount = 0;
      
      frequencies.forEach(freq => {
        if (freq < nyquist) {
          const binIndex = Math.round(freq / binSize);
          if (binIndex < frequencyData.length) {
            // Include fundamental + harmonics with decreasing weight
            const harmonics = [1, 2, 3, 4, 5, 6]; // More harmonics
            
            harmonics.forEach((harmonic, idx) => {
              const harmonicIndex = Math.round((freq * harmonic) / binSize);
              if (harmonicIndex < frequencyData.length) {
                const weight = 1 / (harmonic * 0.5); // Less aggressive decay
                totalEnergy += (frequencyData[harmonicIndex] * weight);
                harmonicCount++;
              }
            });
          }
        }
      });
      
      noteEnergies[note] = harmonicCount > 0 ? totalEnergy / harmonicCount : 0;
    });

    // Method 2: Chord detection - look for common chord patterns
    const chordBonus: { [key: string]: number } = {};
    
    // Major and minor triads
    const chordPatterns = {
      'C': ['C', 'E', 'G'],    // C major
      'C#': ['C#', 'F', 'G#'],  // C# major
      'D': ['D', 'F#', 'A'],    // D major
      'D#': ['D#', 'G', 'A#'],  // D# major
      'E': ['E', 'G#', 'B'],    // E major
      'F': ['F', 'A', 'C'],     // F major
      'F#': ['F#', 'A#', 'C#'], // F# major
      'G': ['G', 'B', 'D'],     // G major
      'G#': ['G#', 'C', 'D#'],  // G# major
      'A': ['A', 'C#', 'E'],    // A major
      'A#': ['A#', 'D', 'F'],   // A# major
      'B': ['B', 'D#', 'F#']    // B major
    };

    Object.entries(chordPatterns).forEach(([root, chordNotes]) => {
      let chordStrength = 0;
      chordNotes.forEach(note => {
        chordStrength += noteEnergies[note] || 0;
      });
      chordBonus[root] = chordStrength / chordNotes.length;
    });

    // Combine individual note detection with chord detection
    const combinedScores: { [key: string]: number } = {};
    Object.keys(noteEnergies).forEach(note => {
      combinedScores[note] = (noteEnergies[note] * 0.7) + ((chordBonus[note] || 0) * 0.3);
    });

    // Find the strongest key
    let maxEnergy = 0;
    let dominantNote = '';
    
    Object.entries(combinedScores).forEach(([note, energy]) => {
      if (energy > maxEnergy) {
        maxEnergy = energy;
        dominantNote = note;
      }
    });

    // Method 3: Historical smoothing for stability
    const totalEnergy = Object.values(combinedScores).reduce((sum, energy) => sum + energy, 0);
    const rawConfidence = totalEnergy > 0 ? maxEnergy / totalEnergy : 0;

    // Apply temporal smoothing
    if (dominantNote && rawConfidence > 0.08) { // Much lower threshold
      const now = Date.now();
      keyHistoryRef.current.push({ 
        key: dominantNote, 
        confidence: rawConfidence, 
        timestamp: now 
      });

      // Keep only recent history (last 2 seconds)
      keyHistoryRef.current = keyHistoryRef.current.filter(entry => 
        now - entry.timestamp < 2000
      );

      // Calculate weighted average confidence for each key
      const keyVotes: { [key: string]: { total: number; count: number } } = {};
      
      keyHistoryRef.current.forEach(entry => {
        if (!keyVotes[entry.key]) {
          keyVotes[entry.key] = { total: 0, count: 0 };
        }
        keyVotes[entry.key].total += entry.confidence;
        keyVotes[entry.key].count += 1;
      });

      // Find the most consistent key
      let bestKey = '';
      let bestScore = 0;
      
      Object.entries(keyVotes).forEach(([key, votes]) => {
        const avgConfidence = votes.total / votes.count;
        const consistency = votes.count / keyHistoryRef.current.length;
        const score = avgConfidence * consistency;
        
        if (score > bestScore && votes.count >= 2) { // Need at least 2 votes
          bestScore = score;
          bestKey = key;
        }
      });

      // Update key if we have a strong enough candidate
      if (bestKey && bestScore > 0.1) { // Even lower final threshold
        const finalConfidence = Math.min(bestScore * 2, 1.0); // Boost confidence display
        
        const newKey: KeyAnalysis = {
          key: bestKey,
          confidence: finalConfidence,
          lastUpdate: now
        };

        setDetectedKey(newKey);
        onKeyDetected?.(bestKey, finalConfidence);
      }
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-3 bg-gray-900 rounded-lg border border-gray-700 shadow-lg z-50"
      >
        <Eye className="w-5 h-5 text-gray-400" />
      </button>
    );
  }

  return (
  <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700 p-4">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-medium text-white flex items-center gap-2">
        <Activity className="w-5 h-5" />
        Sound Monitor
      </h3>
      {/* Remove the close button or make it toggle minimized state instead */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="p-1 text-gray-400 hover:text-white"
        title={isVisible ? "Minimize" : "Expand"}
      >
        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>

    {/* Show content when visible, otherwise show minimal state */}
    {isVisible ? (
      <div className="space-y-4">
        {/* Main Content - Horizontal Layout */}
        <div className="flex gap-6">
          {/* Left Section: Volume Meters */}
          <div className="flex-shrink-0">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-3">
              <Volume2 className="w-4 h-4" />
              Master Levels
            </h4>
            
            <div className="flex gap-4 items-end">
              {(['L', 'R'] as const).map((channel) => {
                const levels = currentLevels[channel];
                const peakHold = peakHolds[channel];
                const isWarning = volumeWarnings[channel];
                
                return (
                  <div key={channel} className="flex flex-col items-center gap-2">
                    {/* Channel Label */}
                    <div className="text-xs text-gray-400 font-medium">
                      {channel === 'L' ? 'LEFT' : 'RIGHT'}
                    </div>
                    
                    {/* Segmented Meter */}
                    <div className="w-6 h-20 flex items-end">
                      <SegmentedMeter
                        level={levels}
                        peakHold={peakHold}
                        isWarning={isWarning}
                        channel={channel}
                      />
                    </div>
                    
                    {/* Digital Readout */}
                    <div className="text-xs text-gray-400 font-mono text-center w-12">
                      {meterMode === 'peak' && `${(levels.peak * 100).toFixed(0)}`}
                      {meterMode === 'rms' && `${(levels.rms * 100).toFixed(0)}`}
                      {meterMode === 'both' && (
                        <div>
                          <div>P:{(levels.peak * 100).toFixed(0)}</div>
                          <div>R:{(levels.rms * 100).toFixed(0)}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Warning Indicator */}
                    {isWarning && (
                      <VolumeX className="w-3 h-3 text-red-500 animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Section: Key Detection */}
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-3">
              <Music className="w-4 h-4" />
              Key Detection
            </h4>
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {detectedKey.key || '--'}
              </div>
              <div className="text-sm text-gray-400 mb-2">Detected Key</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${detectedKey.confidence * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(detectedKey.confidence * 100)}% confidence
              </div>
            </div>
          </div>
        </div>

        {/* Controls - Horizontal Layout */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
          <div className="flex gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Gain</label>
              <select
                value={meterGain}
                onChange={(e) => setMeterGain(Number(e.target.value))}
                className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600"
              >
                <option value={0.5}>0.5x</option>
                <option value={1.0}>1.0x</option>
                <option value={1.5}>1.5x</option>
                <option value={2.0}>2.0x</option>
                <option value={3.0}>3.0x</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-400 mb-1">Mode</label>
              <select
                value={meterMode}
                onChange={(e) => setMeterMode(e.target.value as 'rms' | 'peak' | 'both')}
                className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600"
              >
                <option value="rms">RMS</option>
                <option value="peak">Peak</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={holdPeaks}
                onChange={(e) => setHoldPeaks(e.target.checked)}
                className="rounded"
              />
              Peak Hold
            </label>
          </div>
        </div>
      </div>
    ) : (
      // Minimized view
      <div className="text-center py-2">
        <div className="text-sm text-gray-400">Sound Monitor (minimized)</div>
        <div className="flex justify-center gap-4 mt-2">
          <div className="text-xs text-gray-500">
            L: {Math.round(currentLevels.L.peak * 100)}%
          </div>
          <div className="text-xs text-gray-500">
            R: {Math.round(currentLevels.R.peak * 100)}%
          </div>
        </div>
      </div>
    )}
  </div>
);
}