// components/WaveformDemo.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

interface Annotation {
  timestamp: number;
  type: 'comment' | 'issue' | 'approval' | 'marker';
  user: string;
  text: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export default function WaveformDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  
  const duration = 60; // Shorter demo - 1 minute for better visibility
  
  // Demo annotation data that appears during playback
  const annotations: Annotation[] = [
    {
      timestamp: 8,
      type: 'comment',
      user: 'Artist_Sarah',
      text: 'Love this intro! The synth pad is perfect 🔥',
      priority: 'low'
    },
    {
      timestamp: 16,
      type: 'issue',
      user: 'Artist_Sarah', 
      text: 'The kick feels a bit muddy here. Maybe high-pass the sub?',
      priority: 'high'
    },
    {
      timestamp: 28,
      type: 'marker',
      user: 'Producer_Mike',
      text: 'Verse 1 start - ready for vocals',
      priority: 'medium'
    },
    {
      timestamp: 38,
      type: 'comment',
      user: 'Artist_Sarah',
      text: 'This breakdown hits different! 🎯',
      priority: 'low'
    },
    {
      timestamp: 48,
      type: 'issue',
      user: 'Artist_Sarah',
      text: 'Bridge feels too empty. Maybe add some percussion fills?',
      priority: 'critical'
    },
    {
      timestamp: 55,
      type: 'approval',
      user: 'Artist_Sarah',
      text: 'Final section approved! Ready to record vocals 🎤',
      priority: 'high'
    }
  ];

  // Generate waveform data
  const waveformBars = Array.from({ length: 150 }, (_, i) => {
    // Create more realistic waveform pattern
    const position = i / 150;
    let height = Math.sin(position * Math.PI * 8) * 0.3 + 0.7; // Base wave pattern
    height += Math.random() * 0.4 - 0.2; // Add some randomness
    height = Math.max(0.1, Math.min(1, height)); // Clamp between 0.1 and 1
    return height;
  });

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const handleWaveformClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = clickX / rect.width;
    setCurrentTime(progress * duration);
  };

  const handleAnnotationHover = (annotation: Annotation, e: React.MouseEvent) => {
    setHoveredAnnotation(annotation);
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleAnnotationLeave = () => {
    setHoveredAnnotation(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredAnnotation) {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAnnotationColor = (type: string): string => {
    switch (type) {
      case 'comment': return 'bg-skribble-azure';
      case 'issue': return 'bg-red-500';
      case 'approval': return 'bg-green-500';
      case 'marker': return 'bg-skribble-purple';
      default: return 'bg-skribble-azure';
    }
  };

  const getAnnotationIcon = (type: string): string => {
    switch (type) {
      case 'comment': return '💬';
      case 'issue': return '⚠️';
      case 'approval': return '✅';
      case 'marker': return '📍';
      default: return '💬';
    }
  };

  // Animation loop - slower for better visibility
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setCurrentTime(prev => {
          const next = prev + 0.05; // Slower animation speed
          return next >= duration ? 0 : next;
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, duration]);

  // Auto-start demo after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPlaying(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const progress = (currentTime / duration) * 100;
  // Show annotations when we're within 2 seconds of them OR have passed them
  const visibleAnnotations = annotations.filter(ann => 
    currentTime >= ann.timestamp - 2 && currentTime <= ann.timestamp + 10
  );

  return (
    <div className="relative max-w-4xl mx-auto">
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
        {/* Header with user info */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-skribble-azure to-skribble-purple flex items-center justify-center text-white text-sm font-medium">
              P
            </div>
            <span className="text-skribble-sky text-sm">Producer_Mike</span>
          </div>
          <div className="text-xs text-skribble-azure bg-skribble-dark/50 px-3 py-1 rounded-full">
            🎵 Live Demo
          </div>
        </div>

        {/* Waveform */}
        <div 
          ref={containerRef}
          className="relative h-32 bg-skribble-dark/50 rounded-lg cursor-pointer group"
          onClick={handleWaveformClick}
          onMouseMove={handleMouseMove}
        >
        {/* Waveform */}
        <div 
          ref={containerRef}
          className="relative h-32 bg-skribble-dark/50 rounded-lg cursor-pointer group"
          onClick={handleWaveformClick}
          onMouseMove={handleMouseMove}
        >
          {/* Waveform bars */}
          <div className="absolute inset-0 flex items-center justify-center gap-1 p-4">
            {waveformBars.map((height, i) => {
              const barProgress = (i / waveformBars.length) * 100;
              const isActive = barProgress <= progress;
              
              return (
                <div
                  key={i}
                  className={`rounded-sm transition-all duration-75 flex-1 min-w-[1px] ${
                    isActive 
                      ? 'bg-gradient-to-t from-blue-400 to-blue-300 shadow-sm shadow-blue-400/30' 
                      : 'bg-gradient-to-t from-skribble-azure/60 to-skribble-sky/60'
                  }`}
                  style={{
                    height: `${height * 80}%`,
                    opacity: isActive ? 1 : 0.6
                  }}
                />
              );
            })}
          </div>

          {/* Progress cursor */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 shadow-lg z-10 transition-all duration-75"
            style={{ 
              left: `${progress}%`,
              backgroundColor: 'skyblue',
              boxShadow: '0 0 10px rgba(198, 216, 255, 0.5)'
            }}
          />
        </div>

        {/* Annotations - completely separate from waveform */}
        <div className="absolute left-0 right-0" style={{ top: '60px' }}>
          {visibleAnnotations.map((annotation, index) => {
            const annotationProgress = (annotation.timestamp / duration) * 100;
            const hasPassedTimestamp = currentTime >= annotation.timestamp;
            
            return (
              <div
                key={`${annotation.timestamp}-${index}`}
                className="absolute transform -translate-x-1/2 z-30"
                style={{ 
                  left: `${annotationProgress}%`,
                  top: '-45px' // Position above the waveform
                }}
                onMouseEnter={(e) => handleAnnotationHover(annotation, e)}
                onMouseLeave={handleAnnotationLeave}
              >
                {/* Annotation bubble - small chat bubble style */}
                <div className={`relative text-white px-3 py-2 rounded-lg text-xs shadow-lg border border-white/20 hover:scale-110 transition-all duration-300 cursor-pointer ${
                  annotation.type === 'comment' ? 'bg-blue-500' :
                  annotation.type === 'issue' ? 'bg-red-500' :
                  annotation.type === 'approval' ? 'bg-green-500' :
                  'bg-purple-500'
                } ${hasPassedTimestamp ? 'scale-105 shadow-xl' : 'scale-90 opacity-80'}`}
                style={{ minWidth: '80px', maxWidth: '120px' }}>
                  
                  {/* Icon and user */}
                  <div className="flex items-center gap-1 justify-center">
                    <span className="text-sm">{getAnnotationIcon(annotation.type)}</span>
                    <span className="font-medium text-xs">{annotation.user.split('_')[1]}</span>
                  </div>
                  
                  {/* Tail pointing down */}
                  <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent ${
                    annotation.type === 'comment' ? 'border-t-blue-500' :
                    annotation.type === 'issue' ? 'border-t-red-500' :
                    annotation.type === 'approval' ? 'border-t-green-500' :
                    'border-t-purple-500'
                  } border-t-4`}></div>
                </div>

                {/* Annotation line - only from bubble to waveform top */}
                <div className={`absolute left-1/2 transform -translate-x-1/2 w-0.5 opacity-60 transition-all duration-300 ${
                  annotation.type === 'comment' ? 'bg-blue-500' :
                  annotation.type === 'issue' ? 'bg-red-500' :
                  annotation.type === 'approval' ? 'bg-green-500' :
                  'bg-purple-500'
                } ${hasPassedTimestamp ? 'opacity-100' : ''}`} 
                style={{ top: '30px', height: '15px' }} />
              </div>
            );
          })}
        </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayback}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-skribble-azure to-skribble-purple text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg hover:shadow-skribble-azure/25"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="text-sm text-skribble-sky font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          <div className="font-madimi text-lg text-skribble-sky">
            🎵 Lose Control v2.1
          </div>
          
          <div className="text-xs text-skribble-azure">
            {visibleAnnotations.length > 0 
              ? `${visibleAnnotations.length} active annotations • Hover to see details`
              : 'Annotations will appear as the track plays'
            }
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredAnnotation && (
        <div 
          className="fixed z-50 bg-black/90 text-white p-4 rounded-lg shadow-2xl border border-white/20 max-w-xs pointer-events-none transition-opacity duration-200"
          style={{ 
            left: mousePosition.x + 20, 
            top: mousePosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-medium text-skribble-azure mb-1">
            {hoveredAnnotation.user} • {hoveredAnnotation.type}
          </div>
          <div className="text-xs text-white/70 mb-2">
            Priority: {hoveredAnnotation.priority} • @ {formatTime(hoveredAnnotation.timestamp)}
          </div>
          <div className="text-sm">
            "{hoveredAnnotation.text}"
          </div>
        </div>
      )}

      {/* Famous quote */}
      <div className="text-center mt-6 text-xs text-skribble-azure/70 italic">
        "The whole is greater than the sum of its parts." - Aristotle
      </div>
    </div>
  );
}