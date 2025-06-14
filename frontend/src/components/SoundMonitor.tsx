// Enhanced SoundMonitor.tsx with better gain control
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, AlertTriangle, Activity, Music, Settings, Plus, Minus } from 'lucide-react';

interface SoundMonitorProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  currentTime: number;
  audioBuffer?: AudioBuffer | null;
  onTempoDetected?: (bpm: number) => void;
  onKeyDetected?: (key: string, confidence: number) => void;
  onVolumeWarning?: (channel: 'L' | 'R', level: number) => void;
}

interface VolumeLevel {
  L: number;
  R: number;
  peak: number;
  rms: number;
}

interface TempoAnalysis {
  bpm: number;
  confidence: number;
  lastUpdate: number;
}

interface KeyAnalysis {
  key: string;
  confidence: number;
  lastUpdate: number;
}

const VOLUME_WARNING_THRESHOLD = 0.95; // 95% of max volume
const TEMPO_UPDATE_INTERVAL = 2000; // Update tempo every 2 seconds
const KEY_UPDATE_INTERVAL = 5000; // Update key every 5 seconds

export default function SoundMonitor({
  analyser,
  isPlaying,
  currentTime,
  audioBuffer,
  onTempoDetected,
  onKeyDetected,
  onVolumeWarning
}: SoundMonitorProps) {
  const [volumeLevels, setVolumeLevels] = useState<VolumeLevel>({ L: 0, R: 0, peak: 0, rms: 0 });
  const [tempo, setTempo] = useState<TempoAnalysis>({ bpm: 0, confidence: 0, lastUpdate: 0 });
  const [detectedKey, setDetectedKey] = useState<KeyAnalysis>({ key: '', confidence: 0, lastUpdate: 0 });
  const [volumeWarnings, setVolumeWarnings] = useState<{ L: boolean; R: boolean }>({ L: false, R: false });
  
  // New gain control states
  const [meterGain, setMeterGain] = useState(1.0); // Default 3x gain
  const [meterMode, setMeterMode] = useState<'rms' | 'peak' | 'both'>('both');
  const [showSettings, setShowSettings] = useState(false);
  const [holdPeaks, setHoldPeaks] = useState(true);
  
  const animationFrameRef = useRef<number | null>(null);
  const peakHistoryRef = useRef<number[]>([]);
  const frequencyHistoryRef = useRef<number[][]>([]);
  const lastTempoUpdateRef = useRef(0);
  const lastKeyUpdateRef = useRef(0);
  const peakHoldRef = useRef<{ L: number; R: number; decay: number }>({ L: 0, R: 0, decay: 0 });

  // Note frequencies for key detection (equal temperament, A4 = 440Hz)
  const noteFrequencies = {
    'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
    'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
    'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
  };

  // Enhanced RMS calculation with gain
  const calculateRMS = (data: Uint8Array): number => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / data.length);
  };

  // Enhanced peak calculation
  const calculatePeak = (data: Uint8Array): number => {
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = Math.abs((data[i] - 128) / 128);
      peak = Math.max(peak, normalized);
    }
    return peak;
  };

  // Calculate both frequency-based L/R and time-domain L/R
  const calculateStereoLevels = (timeData: Uint8Array, frequencyData: Uint8Array) => {
    const halfLength = Math.floor(timeData.length / 2);
    
    // Method 1: Split time domain data (simulated stereo)
    const leftTime = timeData.slice(0, halfLength);
    const rightTime = timeData.slice(halfLength);
    
    // Method 2: Split frequency domain (low freq = left, high freq = right)
    const leftFreq = frequencyData.slice(0, halfLength);
    const rightFreq = frequencyData.slice(halfLength);
    
    // Calculate levels for both methods and average them
    const leftRMS = (calculateRMS(leftTime) + calculateRMS(leftFreq)) / 2;
    const rightRMS = (calculateRMS(rightTime) + calculateRMS(rightFreq)) / 2;
    
    const leftPeak = (calculatePeak(leftTime) + calculatePeak(leftFreq)) / 2;
    const rightPeak = (calculatePeak(rightTime) + calculatePeak(rightFreq)) / 2;
    
    return {
      L: { rms: leftRMS, peak: leftPeak },
      R: { rms: rightRMS, peak: rightPeak }
    };
  };

  // Analyze real-time audio data with enhanced gain control
  const analyzeAudio = useCallback(() => {
    if (!analyser || !isPlaying) return;

    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);
    
    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);

    // Calculate enhanced stereo levels
    const stereoLevels = calculateStereoLevels(timeData, frequencyData);
    
    // Apply gain and calculate final levels based on mode
    let leftLevel, rightLevel;
    
    switch (meterMode) {
      case 'rms':
        leftLevel = Math.min(stereoLevels.L.rms * meterGain, 1.0);
        rightLevel = Math.min(stereoLevels.R.rms * meterGain, 1.0);
        break;
      case 'peak':
        leftLevel = Math.min(stereoLevels.L.peak * meterGain, 1.0);
        rightLevel = Math.min(stereoLevels.R.peak * meterGain, 1.0);
        break;
      case 'both':
      default:
        // Combine RMS and peak (weighted average)
        leftLevel = Math.min(((stereoLevels.L.rms * 0.7) + (stereoLevels.L.peak * 0.3)) * meterGain, 1.0);
        rightLevel = Math.min(((stereoLevels.R.rms * 0.7) + (stereoLevels.R.peak * 0.3)) * meterGain, 1.0);
        break;
    }

    // Peak hold logic
    if (holdPeaks) {
      if (leftLevel > peakHoldRef.current.L) {
        peakHoldRef.current.L = leftLevel;
        peakHoldRef.current.decay = 0;
      } else {
        peakHoldRef.current.decay += 0.01;
        peakHoldRef.current.L = Math.max(0, peakHoldRef.current.L - peakHoldRef.current.decay);
      }

      if (rightLevel > peakHoldRef.current.R) {
        peakHoldRef.current.R = rightLevel;
      } else {
        peakHoldRef.current.R = Math.max(0, peakHoldRef.current.R - peakHoldRef.current.decay);
      }
    }

    // Calculate overall peak and RMS
    const overallPeak = Math.max(stereoLevels.L.peak, stereoLevels.R.peak);
    const overallRMS = (stereoLevels.L.rms + stereoLevels.R.rms) / 2;

    const newVolumeLevels: VolumeLevel = {
      L: leftLevel,
      R: rightLevel,
      peak: overallPeak * meterGain,
      rms: overallRMS * meterGain
    };

    setVolumeLevels(newVolumeLevels);

    // Check for volume warnings (use original levels without gain for warnings)
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

    // Store history for tempo and key analysis (rest of the analysis remains the same)
    peakHistoryRef.current.push(overallPeak);
    frequencyHistoryRef.current.push(Array.from(frequencyData));

    // Keep only recent data (last 10 seconds worth)
    const maxHistoryLength = 60 * 10; // assuming 60fps
    if (peakHistoryRef.current.length > maxHistoryLength) {
      peakHistoryRef.current = peakHistoryRef.current.slice(-maxHistoryLength);
    }
    if (frequencyHistoryRef.current.length > maxHistoryLength) {
      frequencyHistoryRef.current = frequencyHistoryRef.current.slice(-maxHistoryLength);
    }

    // Analyze tempo periodically
    const now = Date.now();
    if (now - lastTempoUpdateRef.current > TEMPO_UPDATE_INTERVAL) {
      analyzeTempo();
      lastTempoUpdateRef.current = now;
    }

    // Analyze key periodically
    if (now - lastKeyUpdateRef.current > KEY_UPDATE_INTERVAL) {
      analyzeKey(frequencyData);
      lastKeyUpdateRef.current = now;
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [analyser, isPlaying, meterGain, meterMode, holdPeaks, volumeWarnings, onVolumeWarning]);

  // Enhanced tempo detection focusing on kick frequencies (below 100Hz)
  const analyzeTempo = () => {
    if (frequencyHistoryRef.current.length < 120) return; // Need at least 2 seconds of data

    // Extract kick drum frequencies (20Hz - 100Hz) from frequency data
    const kickFrequencies: number[] = [];
    
    if (analyser) {
      const sampleRate = analyser.context.sampleRate;
      const nyquist = sampleRate / 2;
      const binSize = nyquist / analyser.frequencyBinCount;
      
      const kickStartBin = Math.round(20 / binSize); // 20Hz
      const kickEndBin = Math.round(100 / binSize); // 100Hz
      
      // Analyze kick frequencies from recent history
      frequencyHistoryRef.current.slice(-120).forEach(frequencyData => {
        let kickEnergy = 0;
        for (let i = kickStartBin; i < kickEndBin && i < frequencyData.length; i++) {
          kickEnergy += frequencyData[i];
        }
        kickFrequencies.push(kickEnergy / (kickEndBin - kickStartBin)); // Average kick energy
      });
    } else {
      // Fallback to peak detection if no analyser
      kickFrequencies.push(...peakHistoryRef.current.slice(-120));
    }

    if (kickFrequencies.length < 60) return;

    // Find kick hits (peaks in kick frequency range)
    const threshold = Math.max(...kickFrequencies) * 0.7; // Higher threshold for kick detection
    const kickHits: number[] = [];
    
    // Enhanced peak detection with minimum spacing
    const minSpacing = 15; // Minimum frames between kicks (prevents double detection)
    let lastPeakIndex = -minSpacing;
    
    for (let i = 2; i < kickFrequencies.length - 2; i++) {
      const current = kickFrequencies[i];
      const prev1 = kickFrequencies[i - 1];
      const prev2 = kickFrequencies[i - 2];
      const next1 = kickFrequencies[i + 1];
      const next2 = kickFrequencies[i + 2];
      
      // More sophisticated peak detection
      if (current > threshold && 
          current > prev1 && current > prev2 &&
          current > next1 && current > next2 &&
          i - lastPeakIndex >= minSpacing) {
        kickHits.push(i);
        lastPeakIndex = i;
      }
    }

    if (kickHits.length < 3) return; // Need at least 3 kicks to establish tempo

    // Calculate intervals between kick hits
    const intervals: number[] = [];
    for (let i = 1; i < kickHits.length; i++) {
      const interval = (kickHits[i] - kickHits[i - 1]) / 60; // Convert to seconds (assuming 60fps)
      if (interval > 0.25 && interval < 3.0) { // Reasonable tempo range (20-240 BPM)
        intervals.push(60 / interval); // Convert to BPM
      }
    }

    if (intervals.length > 0) {
      // Advanced tempo clustering
      const bpm = findMostCommonTempo(intervals);
      const confidence = calculateTempoConfidence(intervals, bpm);
      
      // Only update if confidence is reasonable
      if (confidence > 0.3) {
        const newTempo: TempoAnalysis = {
          bpm: Math.round(bpm),
          confidence,
          lastUpdate: Date.now()
        };

        setTempo(newTempo);
        onTempoDetected?.(newTempo.bpm);
      }
    }
  };

  const findMostCommonTempo = (intervals: number[]): number => {
    // Improved tempo clustering with tighter grouping
    const histogram: { [key: number]: number } = {};
    
    intervals.forEach(bpm => {
      // Group by 2 BPM instead of 5 for more precision
      const rounded = Math.round(bpm / 2) * 2;
      histogram[rounded] = (histogram[rounded] || 0) + 1;
    });

    let maxCount = 0;
    let mostCommon = 120;

    Object.entries(histogram).forEach(([bpm, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = parseInt(bpm);
      }
    });

    return mostCommon;
  };

  const calculateTempoConfidence = (intervals: number[], targetBpm: number): number => {
    if (intervals.length === 0) return 0;
    
    // Tighter tolerance for kick-based detection
    const tolerance = 6; // ±6 BPM tolerance
    const matchingIntervals = intervals.filter(bpm => 
      Math.abs(bpm - targetBpm) <= tolerance
    );

    const confidence = matchingIntervals.length / intervals.length;
    
    // Bonus confidence for common musical tempos
    const musicalTempos = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180];
    const isMusicalTempo = musicalTempos.some(tempo => Math.abs(targetBpm - tempo) <= 5);
    
    return isMusicalTempo ? Math.min(confidence * 1.2, 1.0) : confidence;
  };

  const analyzeKey = (frequencyData: Uint8Array) => {
    if (!analyser) return;

    const sampleRate = analyser.context.sampleRate;
    const nyquist = sampleRate / 2;
    const binSize = nyquist / frequencyData.length;
    
    const noteEnergies: { [key: string]: number } = {};
    
    Object.entries(noteFrequencies).forEach(([note, freq]) => {
      const binIndex = Math.round(freq / binSize);
      if (binIndex < frequencyData.length) {
        let energy = 0;
        const harmonics = [1, 2, 3, 4];
        
        harmonics.forEach(harmonic => {
          const harmonicIndex = Math.round((freq * harmonic) / binSize);
          if (harmonicIndex < frequencyData.length) {
            energy += frequencyData[harmonicIndex] / (harmonic * harmonic);
          }
        });
        
        noteEnergies[note] = energy;
      }
    });

    let maxEnergy = 0;
    let dominantNote = '';
    
    Object.entries(noteEnergies).forEach(([note, energy]) => {
      if (energy > maxEnergy) {
        maxEnergy = energy;
        dominantNote = note;
      }
    });

    const totalEnergy = Object.values(noteEnergies).reduce((sum, energy) => sum + energy, 0);
    const confidence = totalEnergy > 0 ? maxEnergy / totalEnergy : 0;

    if (dominantNote && confidence > 0.2) {
      const newKey: KeyAnalysis = {
        key: dominantNote,
        confidence,
        lastUpdate: Date.now()
      };

      setDetectedKey(newKey);
      onKeyDetected?.(newKey.key, newKey.confidence);
    }
  };

  // Start/stop analysis loop
  useEffect(() => {
    if (isPlaying && analyser) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, analyser, analyzeAudio]);

  // Get meter labels based on mode
  const getMeterLabels = () => {
    switch (meterMode) {
      case 'rms':
        return { left: 'RMS-L', right: 'RMS-R' };
      case 'peak':
        return { left: 'PK-L', right: 'PK-R' };
      case 'both':
      default:
        return { left: 'MIX-L', right: 'MIX-R' };
    }
  };

  // Enhanced volume meter component with gain control
  const VolumeMeter = ({ channel, level, isWarning, label }: { 
    channel: 'L' | 'R', 
    level: number, 
    isWarning: boolean,
    label: string 
  }) => {
    const percentage = Math.min(level * 100, 100);
    const segments = 20;
    const activeSegments = Math.floor((percentage / 100) * segments);
    const peakHoldLevel = holdPeaks ? (channel === 'L' ? peakHoldRef.current.L : peakHoldRef.current.R) : 0;
    const peakSegment = Math.floor((peakHoldLevel * 100 / 100) * segments);

    return (
      <div className="flex flex-col items-center space-y-1">
        <span className="text-xs font-mono text-gray-400">{label}</span>
        <div className="flex flex-col-reverse space-y-reverse space-y-1 h-32">
          {Array.from({ length: segments }, (_, i) => {
            const isActive = i < activeSegments;
            const isPeakHold = holdPeaks && i === peakSegment - 1;
            const isRedZone = i >= segments * 0.8;
            const isYellowZone = i >= segments * 0.6;
            
            let colorClass = 'bg-gray-700';
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
                className={`w-3 h-1 ${colorClass} transition-colors duration-100`}
              />
            );
          })}
        </div>
        <span className="text-xs font-mono text-gray-400">
          {percentage.toFixed(1)}%
        </span>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Sound Monitor
        </h3>
        <div className="flex items-center gap-2">
          {!isPlaying && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <VolumeX className="w-4 h-4" />
              Paused
            </span>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? 'bg-gray-700 text-blue-400' : 'text-gray-400 hover:text-gray-300'
            }`}
            title="Meter Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Meter Settings</h4>
          
          {/* Gain Control */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400">Meter Gain</label>
              <span className="text-xs text-white">{meterGain.toFixed(1)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMeterGain(Math.max(0.1, meterGain - 0.5))}
                className="p-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                <Minus className="w-3 h-3 text-gray-300" />
              </button>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={meterGain}
                onChange={(e) => setMeterGain(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <button
                onClick={() => setMeterGain(Math.min(10, meterGain + 0.5))}
                className="p-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                <Plus className="w-3 h-3 text-gray-300" />
              </button>
            </div>
          </div>

          {/* Meter Mode */}
          <div className="mb-3">
            <label className="text-xs text-gray-400 mb-2 block">Meter Mode</label>
            <div className="flex gap-2">
              {(['rms', 'peak', 'both'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setMeterMode(mode)}
                  className={`px-2 py-1 text-xs rounded ${
                    meterMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } transition-colors`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Peak Hold */}
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
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Volume Meters */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Level Meters
          </h4>
          <div className="flex justify-center space-x-8">
            <VolumeMeter 
              channel="L" 
              level={volumeLevels.L} 
              isWarning={volumeWarnings.L} 
              label={getMeterLabels().left}
            />
            <VolumeMeter 
              channel="R" 
              level={volumeLevels.R} 
              isWarning={volumeWarnings.R} 
              label={getMeterLabels().right}
            />
          </div>
          
          {/* Additional Level Info */}
          <div className="text-center text-xs text-gray-400 space-y-1">
            <div>RMS: {Math.round(volumeLevels.rms * 100)}%</div>
            <div>Peak: {Math.round(volumeLevels.peak * 100)}%</div>
          </div>
          
          {(volumeWarnings.L || volumeWarnings.R) && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-2 rounded">
              <AlertTriangle className="w-4 h-4" />
              Volume exceeds safe limits!
            </div>
          )}
        </div>

        {/* Tempo Detection */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Tempo Analysis
          </h4>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {tempo.bpm > 0 ? tempo.bpm : '--'}
            </div>
            <div className="text-sm text-gray-400">BPM</div>
            <div className="mt-2">
              <div className="text-xs text-gray-500">
                Confidence: {Math.round(tempo.confidence * 100)}%
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                <div 
                  className="bg-blue-400 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${tempo.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Key Detection */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Music className="w-4 h-4" />
            Key Detection
          </h4>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {detectedKey.key || '--'}
            </div>
            <div className="text-sm text-gray-400">Key</div>
            <div className="mt-2">
              <div className="text-xs text-gray-500">
                Confidence: {Math.round(detectedKey.confidence * 100)}%
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                <div 
                  className="bg-purple-400 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${detectedKey.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>
          Status: {isPlaying ? (
            <span className="text-green-400">● Active</span>
          ) : (
            <span className="text-gray-500">● Paused</span>
          )}
        </span>
        <span>
          Time: {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
        </span>
        <span>Gain: {meterGain}x | Mode: {meterMode.toUpperCase()}</span>
      </div>
    </div>
  );
}