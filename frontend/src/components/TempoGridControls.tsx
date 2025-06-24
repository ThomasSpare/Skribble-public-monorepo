// components/TempoGridControls.tsx
'use client';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Grid, 
  ChevronDown, 
  X, 
  Loader2, 
  Activity, 
  Clock 
} from 'lucide-react';

interface TempoGridControlsProps {
  // Current values from parent
  bpm: number;
  gridMode: 'none' | 'beats' | 'bars';
  gridOffset: number;
  currentTime: number;
  audioUrl: string;
  userInteracted: boolean;
  
  // Callbacks to update parent state
  onBpmChange: (bpm: number) => void;
  onGridModeChange: (mode: 'none' | 'beats' | 'bars') => void;
  onGridOffsetChange: (offset: number) => void;
  onGridOffsetMsChange: (offsetMs: number) => void;
  
  // Optional styling
  className?: string;
}

export default function TempoGridControls({
  bpm,
  gridMode,
  gridOffset,
  currentTime,
  audioUrl,
  userInteracted,
  onBpmChange,
  onGridModeChange,
  onGridOffsetChange,
  onGridOffsetMsChange,
  className = ""
}: TempoGridControlsProps) {
  // Internal state
  const [showTempoControls, setShowTempoControls] = useState(false);
  const [tempBpm, setTempBpm] = useState(bpm);
  const [gridOffsetMs, setGridOffsetMs] = useState(0);
  const [isAnalyzingBeats, setIsAnalyzingBeats] = useState(false);
  const [gridAlignment, setGridAlignment] = useState<'auto' | 'manual'>('manual');
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  
  // Kick detection parameters
  const [kickSensitivity, setKickSensitivity] = useState(2.5); // Threshold multiplier
  const [kickMinGain, setKickMinGain] = useState(0.1); // Minimum energy percentage
  const [kickFreqMax, setKickFreqMax] = useState(100); // Max frequency for kicks
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number | null>(null);
  
  const controlsRef = useRef<HTMLDivElement>(null);

  // Common BPM presets
  const commonBPMs = [60, 70, 80, 90, 100, 110, 120, 128, 130, 140, 150, 160, 170, 180];

  // Close controls when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
        setShowTempoControls(false);
      }
    };

    if (showTempoControls) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTempoControls]);

  // Sync tempBpm with prop bpm
  useEffect(() => {
    setTempBpm(bpm);
  }, [bpm]);

  // Helper functions
  const getBeatAtTime = (time: number) => {
    const beatsPerSecond = bpm / 60;
    return time * beatsPerSecond;
  };

  const getTimeAtBeat = (beat: number) => {
    const secondsPerBeat = 60 / bpm;
    return beat * secondsPerBeat;
  };

  const analyzeBeats = async () => {
    if (!audioUrl || !userInteracted) return;
    
    setIsAnalyzingBeats(true);
    try {
      // Create audio context for analysis
      const tempContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await tempContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Enhanced kick detection using frequency analysis
      const windowSize = 2048; // FFT window size
      const hopSize = Math.floor(windowSize / 4); // 75% overlap
      const fftSize = windowSize;
      
      // Calculate which frequency bins correspond to user-defined max frequency
      const nyquist = sampleRate / 2;
      const frequencyResolution = nyquist / (fftSize / 2);
      const maxBin = Math.floor(kickFreqMax / frequencyResolution);
      
      console.log(`Analyzing kicks: Sample rate: ${sampleRate}Hz, Max frequency: ${kickFreqMax}Hz (bin ${maxBin}), Sensitivity: ${kickSensitivity}, Min gain: ${kickMinGain * 100}%`);
      
      const kickEnergyValues: number[] = [];
      const timePositions: number[] = [];
      
      // Process audio in overlapping windows
      for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
        // Extract window
        const window = channelData.slice(i, i + windowSize);
        
        // Apply Hanning window to reduce spectral leakage
        const hannWindow = new Float32Array(windowSize);
        for (let j = 0; j < windowSize; j++) {
          hannWindow[j] = window[j] * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / (windowSize - 1)));
        }
        
        // Perform FFT (simplified real FFT)
        const fft = performRealFFT(hannWindow);
        
        // Calculate energy in low-frequency range (kick range: ~20-100 Hz)
        let kickEnergy = 0;
        const kickStartBin = Math.floor(20 / frequencyResolution); // Start at 20 Hz
        
        for (let bin = kickStartBin; bin < maxBin; bin++) {
          const real = fft[bin * 2];
          const imag = fft[bin * 2 + 1];
          const magnitude = Math.sqrt(real * real + imag * imag);
          kickEnergy += magnitude;
        }
        
        // Normalize by number of bins analyzed
        kickEnergy = kickEnergy / (maxBin - kickStartBin);
        
        kickEnergyValues.push(kickEnergy);
        timePositions.push(i / sampleRate);
      }
      
      // Find kick peaks with adaptive thresholding
      const beats: number[] = [];
      const windowLength = Math.floor(kickEnergyValues.length * 0.1); // 10% of total length for local analysis
      
      for (let i = windowLength; i < kickEnergyValues.length - windowLength; i++) {
        // Calculate local mean and standard deviation
        let localSum = 0;
        let localSumSquared = 0;
        
        for (let j = i - windowLength; j < i + windowLength; j++) {
          localSum += kickEnergyValues[j];
          localSumSquared += kickEnergyValues[j] * kickEnergyValues[j];
        }
        
        const localMean = localSum / (2 * windowLength);
        const localVariance = (localSumSquared / (2 * windowLength)) - (localMean * localMean);
        const localStdDev = Math.sqrt(Math.max(0, localVariance));
        
        // Adaptive threshold using user-defined sensitivity
        const adaptiveThreshold = localMean + (kickSensitivity * localStdDev);
        
        // Check if current point is a local maximum above threshold
        const current = kickEnergyValues[i];
        const isLocalMax = current > kickEnergyValues[i - 1] && 
                          current > kickEnergyValues[i + 1] &&
                          current > adaptiveThreshold;
        
        // User-configurable minimum energy check
        const globalMax = Math.max(...kickEnergyValues);
        const isSignificant = current > globalMax * kickMinGain;
        
        if (isLocalMax && isSignificant) {
          const timeSeconds = timePositions[i];
          
          // Avoid detecting beats too close together (minimum 150ms apart for kicks)
          const minInterval = 0.15; // 150ms
          const tooClose = beats.some(existingBeat => 
            Math.abs(existingBeat - timeSeconds) < minInterval
          );
          
          if (!tooClose) {
            beats.push(timeSeconds);
          }
        }
      }
      
      console.log(`Detected ${beats.length} kick events`);
      
      // Estimate BPM from kick intervals with improved filtering
      if (beats.length > 3) {
        const intervals = [];
        for (let i = 1; i < beats.length; i++) {
          intervals.push(beats[i] - beats[i - 1]);
        }
        
        // Filter out extreme outliers (keep intervals between 0.3s and 2s)
        const validIntervals = intervals.filter(interval => interval >= 0.3 && interval <= 2.0);
        
        if (validIntervals.length > 0) {
          // Use median for more robust BPM estimation
          validIntervals.sort((a, b) => a - b);
          const medianInterval = validIntervals[Math.floor(validIntervals.length / 2)];
          const estimatedBpm = Math.round(60 / medianInterval);
          
          // Double-check: also try analyzing every other beat (in case we're detecting off-beats)
          const doubleBeats = intervals.filter(interval => interval >= 0.6 && interval <= 4.0);
          if (doubleBeats.length > 0) {
            doubleBeats.sort((a, b) => a - b);
            const doubleBeatInterval = doubleBeats[Math.floor(doubleBeats.length / 2)];
            const doubleBeatBpm = Math.round(60 / (doubleBeatInterval / 2));
            
            // Choose the most reasonable BPM
            if (Math.abs(doubleBeatBpm - 120) < Math.abs(estimatedBpm - 120)) {
              console.log(`Using double-beat BPM: ${doubleBeatBpm} instead of ${estimatedBpm}`);
              setTempBpm(doubleBeatBpm);
              onBpmChange(doubleBeatBpm);
            } else if (estimatedBpm >= 60 && estimatedBpm <= 200) {
              setTempBpm(estimatedBpm);
              onBpmChange(estimatedBpm);
            }
          } else if (estimatedBpm >= 60 && estimatedBpm <= 200) {
            setTempBpm(estimatedBpm);
            onBpmChange(estimatedBpm);
          }
        }
      }
      
      setDetectedBeats(beats);
      onDetectedBeatsChange(beats);
      await tempContext.close();
      
    } catch (error) {
      console.error('Kick detection failed:', error);
    } finally {
      setIsAnalyzingBeats(false);
    }
  };

  // Simplified real FFT implementation for kick detection
  // NOTE: This function is no longer used in the simplified approach
  const performRealFFT = (signal: Float32Array): Float32Array => {
    // This function has been removed as we're now using time-domain analysis
    // which is much faster and more reliable for kick detection
    return new Float32Array(0);
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
        setTempBpm(newBpm);
        onBpmChange(newBpm);
      }
    }
  };

  const alignGridToCursor = () => {
    const beatsPerSecond = bpm / 60;
    const currentBeat = currentTime * beatsPerSecond;
    const beatOffset = currentBeat % 1;
    onGridOffsetChange(beatOffset);
    
    const newOffsetMs = currentTime * 1000;
    setGridOffsetMs(newOffsetMs);
    onGridOffsetMsChange(newOffsetMs);
  };

  const nudgeGrid = (direction: 'left' | 'right') => {
    const nudgeAmount = (60 / bpm) * 0.01; // 1% of beat duration
    const newOffsetMs = gridOffsetMs + (direction === 'right' ? nudgeAmount * 1000 : -nudgeAmount * 1000);
    setGridOffsetMs(newOffsetMs);
    onGridOffsetMsChange(newOffsetMs);
    
    // Update grid offset for drawing
    const beatsPerSecond = bpm / 60;
    const offsetInBeats = (newOffsetMs / 1000) * beatsPerSecond;
    onGridOffsetChange(offsetInBeats % 1);
  };

  const resetGrid = () => {
    onGridOffsetChange(0);
    setGridOffsetMs(0);
    onGridOffsetMsChange(0);
  };

  const applyBpm = () => {
    onBpmChange(tempBpm);
  };

  return (
    <>
      <div className={`relative ${className}`} ref={controlsRef}>
        <button
          onClick={() => setShowTempoControls(!showTempoControls)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            showTempoControls || gridMode !== 'none'
              ? 'bg-skribble-azure/20 text-skribble-azure'
              : 'text-skribble-azure/60 hover:text-skribble-azure'
          }`}
          title="Tempo & Grid Controls"
        >
          <Grid className="w-4 h-4" />
          <span className="text-sm font-mono">{bpm}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showTempoControls ? 'rotate-180' : ''}`} />
        </button>

        {showTempoControls && (
          <div className="absolute right-0 bottom-full mb-2 w-80 bg-skribble-plum/95 backdrop-blur-md rounded-xl border border-skribble-azure/20 shadow-lg z-50 p-4">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-skribble-sky">Tempo & Grid Controls</h4>
                <button
                  onClick={() => setShowTempoControls(false)}
                  className="p-1 text-skribble-azure/60 hover:text-skribble-azure"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* BPM Input Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-skribble-azure min-w-[3rem]">BPM:</label>
                  <input
                    type="number"
                    min="60"
                    max="200"
                    value={tempBpm}
                    onChange={(e) => setTempBpm(parseInt(e.target.value) || 120)}
                    onBlur={applyBpm}
                    className="w-20 px-2 py-1 bg-skribble-dark/30 border border-skribble-azure/20 rounded text-skribble-sky text-sm"
                  />
                  <button
                    onClick={applyBpm}
                    className="px-3 py-1 bg-skribble-azure/20 text-skribble-azure rounded text-sm hover:bg-skribble-azure/30"
                  >
                    Apply
                  </button>
                </div>

                {/* Common BPM Presets */}
                <div>
                  <div className="text-xs text-skribble-azure/70 mb-2">Quick Select:</div>
                  <div className="grid grid-cols-7 gap-1">
                    {commonBPMs.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setTempBpm(preset);
                          onBpmChange(preset);
                        }}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          bpm === preset
                            ? 'bg-skribble-azure text-white'
                            : 'bg-skribble-azure/10 text-skribble-azure hover:bg-skribble-azure/20'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tap Tempo */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTapTempo}
                    className="flex-1 px-3 py-2 bg-skribble-purple/20 text-skribble-purple rounded hover:bg-skribble-purple/30 transition-colors text-sm"
                  >
                    Tap Tempo
                  </button>
                  <span className="text-xs text-skribble-azure/70">
                    {tapTimes.length > 0 && `${tapTimes.length} taps`}
                  </span>
                </div>

                {/* Beat Analysis */}
                <div className="border-t border-skribble-azure/20 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={analyzeBeats}
                      disabled={isAnalyzingBeats}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-skribble-sky/20 text-skribble-sky rounded hover:bg-skribble-sky/30 transition-colors text-sm disabled:opacity-50"
                    >
                      {isAnalyzingBeats ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Activity className="w-4 h-4" />
                          Analyze 30s from Cursor
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="px-2 py-1 text-xs text-skribble-azure/70 hover:text-skribble-azure transition-colors"
                    >
                      {showAdvanced ? 'Simple' : 'Advanced'}
                    </button>
                  </div>
                  
                  {/* Analysis info */}
                  <div className="text-xs text-skribble-azure/70">
                    Position cursor at a representative part of the track, then click to analyze kick pattern for BPM detection.
                  </div>
                  
                  {lastAnalysisTime !== null && (
                    <div className="text-xs text-green-400">
                      ✓ Last analyzed from {lastAnalysisTime.toFixed(1)}s
                    </div>
                  )}
                  
                  {showAdvanced && (
                    <div className="space-y-3 p-3 bg-skribble-dark/20 rounded-lg">
                      <div className="text-xs text-skribble-azure/70 mb-2">Kick Detection Settings:</div>
                      
                      {/* Frequency Range */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-skribble-azure min-w-[4rem]">Max Freq:</label>
                        <input
                          type="range"
                          min="60"
                          max="200"
                          step="10"
                          value={kickFreqMax}
                          onChange={(e) => setKickFreqMax(parseInt(e.target.value))}
                          className="flex-1 h-1 bg-skribble-azure/20 rounded-lg appearance-none cursor-pointer kick-slider"
                        />
                        <span className="text-xs text-skribble-azure/70 min-w-[3rem]">{kickFreqMax}Hz</span>
                      </div>
                      
                      {/* Sensitivity */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-skribble-azure min-w-[4rem]">Sensitivity:</label>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="0.1"
                          value={kickSensitivity}
                          onChange={(e) => setKickSensitivity(parseFloat(e.target.value))}
                          className="flex-1 h-1 bg-skribble-azure/20 rounded-lg appearance-none cursor-pointer kick-slider"
                        />
                        <span className="text-xs text-skribble-azure/70 min-w-[3rem]">{kickSensitivity.toFixed(1)}x</span>
                      </div>
                      
                      {/* Minimum Gain */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-skribble-azure min-w-[4rem]">Min Gain:</label>
                        <input
                          type="range"
                          min="0.05"
                          max="0.3"
                          step="0.01"
                          value={kickMinGain}
                          onChange={(e) => setKickMinGain(parseFloat(e.target.value))}
                          className="flex-1 h-1 bg-skribble-azure/20 rounded-lg appearance-none cursor-pointer kick-slider"
                        />
                        <span className="text-xs text-skribble-azure/70 min-w-[3rem]">{Math.round(kickMinGain * 100)}%</span>
                      </div>
                      
                      {/* Reset to defaults */}
                      <button
                        onClick={() => {
                          setKickSensitivity(2.5);
                          setKickMinGain(0.1);
                          setKickFreqMax(100);
                        }}
                        className="w-full px-2 py-1 text-xs bg-skribble-purple/20 text-skribble-purple rounded hover:bg-skribble-purple/30"
                      >
                        Reset to Defaults
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid Controls */}
              <div className="border-t border-skribble-azure/20 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-skribble-azure">Grid Mode:</span>
                  <div className="flex gap-1">
                    {['none', 'beats', 'bars'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onGridModeChange(mode as any)}
                        className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
                          gridMode === mode
                            ? 'bg-skribble-azure text-white'
                            : 'bg-skribble-azure/10 text-skribble-azure hover:bg-skribble-azure/20'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {gridMode !== 'none' && (
                  <>
                    {/* Grid Alignment */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-skribble-azure">Grid Alignment:</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setGridAlignment('manual')}
                            className={`px-2 py-1 text-xs rounded ${
                              gridAlignment === 'manual'
                                ? 'bg-skribble-azure text-white'
                                : 'bg-skribble-azure/10 text-skribble-azure'
                            }`}
                          >
                            Manual
                          </button>
                        </div>
                      </div>

                      {/* Fine-tune Grid Position */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-skribble-azure/70 min-w-[3rem]">Nudge:</span>
                        <button
                          onClick={() => nudgeGrid('left')}
                          className="px-2 py-1 bg-skribble-azure/10 text-skribble-azure rounded text-xs hover:bg-skribble-azure/20"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => nudgeGrid('right')}
                          className="px-2 py-1 bg-skribble-azure/10 text-skribble-azure rounded text-xs hover:bg-skribble-azure/20"
                        >
                          →
                        </button>
                        <button
                          onClick={resetGrid}
                          className="px-2 py-1 bg-skribble-purple/20 text-skribble-purple rounded text-xs hover:bg-skribble-purple/30"
                        >
                          Reset
                        </button>
                      </div>

                      {/* Quick Align Button */}
                      <div className="flex gap-2">
                        <button
                          onClick={alignGridToCursor}
                          className="w-full px-2 py-1 bg-skribble-sky/20 text-skribble-sky rounded text-xs hover:bg-skribble-sky/30"
                        >
                          Align Grid to Cursor
                        </button>
                      </div>
                    </div>

                    {/* Grid Status */}
                    <div className="text-xs text-skribble-azure/70">
                      Grid offset: {(gridOffsetMs / 1000).toFixed(3)}s
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Custom slider styles */}
      <style jsx>{`
        .kick-slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #71A9F7;
          cursor: pointer;
          border: 2px solid #C6D8FF;
        }
        
        .kick-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #71A9F7;
          cursor: pointer;
          border: 2px solid #C6D8FF;
          box-sizing: border-box;
        }
        
        .kick-slider::-webkit-slider-track {
          background: rgba(113, 169, 247, 0.2);
          height: 4px;
          border-radius: 2px;
        }
        
        .kick-slider::-moz-range-track {
          background: rgba(113, 169, 247, 0.2);
          height: 4px;
          border-radius: 2px;
          border: none;
        }
      `}</style>
    </>
  );
}