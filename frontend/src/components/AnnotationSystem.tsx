'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Plus, 
  X, 
  Send, 
  Flag, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Edit3,
  Trash2,
  Reply,
  Filter,
  ChevronDown,
  User,
  Loader2,
  Activity,
  Volume2,
  VolumeX,
  Music,
  Eye,
  EyeOff
} from 'lucide-react';
import Image from 'next/image';
import SoundMonitor from './SoundMonitor';
import { getImageUrl } from '@/utils/images';

// Types (keeping your existing types)
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

interface AnnotationSystemProps {
  onAnnotationCreated?: (annotation: AnnotationType) => void;
  onAnnotationUpdated?: (annotation: AnnotationType) => void;
  onAnnotationDeleted?: (annotationId: string) => void;
  audioFileId: string;
  currentTime: number;
  onSeekTo: (timestamp: number) => void;
  currentUser: {
    id: string;
    username: string;
    email: string;
  };
  // New props for SoundMonitor integration
  analyser?: AnalyserNode | null;
  isPlaying?: boolean;
  audioBuffer?: AudioBuffer | null;
}

interface AnnotationFormData {
  text: string;
  annotationType: 'comment' | 'marker' | 'voice' | 'section' | 'issue' | 'approval';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  parentId?: string;
}

export default function AnnotationSystem({ 
  audioFileId, 
  currentTime, 
  onSeekTo,
  currentUser,
  onAnnotationDeleted,
  onAnnotationCreated,
  onAnnotationUpdated,
  // New props for SoundMonitor
  analyser,
  isPlaying = false,
  audioBuffer
}: AnnotationSystemProps) {
  // Existing state (keeping all your original state)
  const [annotations, setAnnotations] = useState<AnnotationType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null); 
  const [filters, setFilters] = useState({
    status: [] as string[],
    priority: [] as string[],
    type: [] as string[],
    userId: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [formData, setFormData] = useState<AnnotationFormData>({
    text: '',
    annotationType: 'comment',
    priority: 'medium',
    timestamp: currentTime,
    parentId: undefined
  });

  // New state for SoundMonitor visibility
  const [showSoundMonitor, setShowSoundMonitor] = useState(true);
  const [detectedTempo, setDetectedTempo] = useState<number>(0);
  const [detectedKey, setDetectedKey] = useState<string>('');

  const formRef = useRef<HTMLDivElement>(null);

  // All your existing functions (keeping them exactly the same)
  useEffect(() => {
    fetchAnnotations();
  }, [audioFileId]);

  useEffect(() => {
    if (showAddForm && !editingId && !replyingTo) {
      setFormData(prev => ({ ...prev, timestamp: currentTime }));
    }
  }, [currentTime, showAddForm, editingId, replyingTo]);

  const fetchAnnotations = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('skribble_token');
      const queryParams = new URLSearchParams();
      
      if (filters.status.length > 0) {
        filters.status.forEach(status => queryParams.append('status', status));
      }
      if (filters.priority.length > 0) {
        filters.priority.forEach(priority => queryParams.append('priority', priority));
      }
      if (filters.type.length > 0) {
        filters.type.forEach(type => queryParams.append('type', type));
      }
      if (filters.userId) {
        queryParams.append('userId', filters.userId);
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/annotations/audio/${audioFileId}${
        queryParams.toString() ? `?${queryParams.toString()}` : ''
      }`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setAnnotations(data.data);
      } else {
        console.error('Failed to fetch annotations:', data.error);
      }
    } catch (error) {
      console.error('Error fetching annotations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // New callback handlers for SoundMonitor
  const handleTempoDetected = (bpm: number) => {
    setDetectedTempo(bpm);
  };

  const handleKeyDetected = (key: string, confidence: number) => {
    setDetectedKey(key);
  };

  const handleVolumeWarning = (channel: 'L' | 'R', level: number) => {
    console.warn(`Volume warning on channel ${channel}: ${Math.round(level * 100)}%`);
  };

  // Missing functions that need to be implemented
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.text.trim()) return;

    try {
      const token = localStorage.getItem('skribble_token');
      const endpoint = editingId 
        ? `${process.env.NEXT_PUBLIC_API_URL}/annotations/${editingId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/annotations`;
      
      const method = editingId ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        audioFileId,
        parentId: replyingTo || formData.parentId
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        if (editingId) {
          onAnnotationUpdated?.(data.data);
        } else {
          onAnnotationCreated?.(data.data);
        }
        resetForm();
        fetchAnnotations();
      }
    } catch (error) {
      console.error('Error submitting annotation:', error);
    }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setReplyingTo(null);
    setFormData({
      text: '',
      annotationType: 'comment',
      priority: 'medium',
      timestamp: currentTime,
      parentId: undefined
    });
  };

  const handleEdit = (annotation: AnnotationType) => {
    setFormData({
      text: annotation.text,
      annotationType: annotation.annotationType,
      priority: annotation.priority,
      timestamp: annotation.timestamp,
      parentId: annotation.parentId
    });
    setEditingId(annotation.id);
    setShowAddForm(true);
  };

  const handleReply = (annotation: AnnotationType) => {
    setFormData({
      text: '',
      annotationType: 'comment',
      priority: 'medium',
      timestamp: currentTime,
      parentId: annotation.parentId || annotation.id
    });
    setReplyingTo(annotation.id);
    setShowAddForm(true);
  };

  const deleteAnnotation = async (annotationId: string) => {
    if (!confirm('Are you sure you want to delete this annotation?')) return;

    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/annotations/${annotationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        onAnnotationDeleted?.(annotationId);
        fetchAnnotations();
      }
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  };

  const resolveAnnotation = async (annotationId: string) => {
    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/annotations/${annotationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'resolved' })
      });

      const data = await response.json();
      if (data.success) {
        onAnnotationUpdated?.(data.data);
        fetchAnnotations();
      }
    } catch (error) {
      console.error('Error resolving annotation:', error);
    }
  };

  // Keep all your existing utility functions
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'issue': return <AlertTriangle className="w-4 h-4" />;
      case 'approval': return <CheckCircle className="w-4 h-4" />;
      case 'marker': return <Flag className="w-4 h-4" />;
      case 'section': return <Edit3 className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 border-red-400';
      case 'high': return 'text-orange-400 border-orange-400';
      case 'medium': return 'text-yellow-400 border-yellow-400';
      case 'low': return 'text-green-400 border-green-400';
      default: return 'text-skribble-azure border-skribble-azure';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-500/20 text-green-200';
      case 'approved': return 'bg-blue-500/20 text-blue-200';
      case 'in-progress': return 'bg-yellow-500/20 text-yellow-200';
      default: return 'bg-skribble-azure/20 text-skribble-azure';
    }
  };

  // Group annotations by parent (for threading)
  const groupedAnnotations = annotations.reduce((acc, annotation) => {
    if (!annotation.parentId) {
      // This is a parent annotation
      acc[annotation.id] = {
        parent: annotation,
        replies: annotations.filter(a => a.parentId === annotation.id)
      };
    }
    return acc;
  }, {} as Record<string, { parent: AnnotationType; replies: AnnotationType[] }>);

  const parentAnnotations = Object.values(groupedAnnotations).sort(
    (a, b) => a.parent.timestamp - b.parent.timestamp
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left Column - SoundMonitor */}
      {showSoundMonitor && (
        <div className="lg:w-1/2 space-y-4">
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl border border-skribble-azure/20 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-skribble-azure" />
                Sound Monitor
              </h3>
              <button
                onClick={() => setShowSoundMonitor(false)}
                className="p-2 rounded-lg text-skribble-azure/60 hover:text-skribble-azure transition-colors"
                title="Hide Sound Monitor"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
            
            <SoundMonitor
              analyser={analyser ?? null}
              isPlaying={isPlaying}
              currentTime={currentTime}
              audioBuffer={audioBuffer}
              onTempoDetected={handleTempoDetected}
              onKeyDetected={handleKeyDetected}
              onVolumeWarning={handleVolumeWarning}
            />
            
            {/* Quick Audio Stats */}
            {(detectedTempo > 0 || detectedKey) && (
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 mt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Detected Audio Info</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {detectedTempo > 0 && (
                    <div>
                      <span className="text-gray-400">Tempo:</span>
                      <span className="text-white ml-2">{detectedTempo} BPM</span>
                    </div>
                  )}
                  {detectedKey && (
                    <div>
                      <span className="text-gray-400">Key:</span>
                      <span className="text-white ml-2">{detectedKey}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Column - Annotations */}
      <div className={`${showSoundMonitor ? 'lg:w-1/2' : 'w-full'}`}>
        <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl border border-skribble-azure/20">
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-skribble-azure/20">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-skribble-azure" />
              <h3 className="font-madimi text-lg text-skribble-sky">
                Annotations ({annotations.length})
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Show Sound Monitor Button (only when hidden) */}
              {!showSoundMonitor && (
                <button
                  onClick={() => setShowSoundMonitor(true)}
                  className="p-2 text-skribble-azure/60 hover:text-skribble-azure transition-colors"
                  title="Show Sound Monitor"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              
              {/* Filters Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors relative"
              >
                <Filter className="w-4 h-4" />
                {(filters.status.length > 0 || filters.priority.length > 0 || filters.type.length > 0) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-skribble-azure rounded-full"></div>
                )}
              </button>
              
              {/* Add Annotation Button */}
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  if (!showAddForm) {
                    setFormData(prev => ({ ...prev, timestamp: currentTime }));
                  }
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-3 py-1 rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Add Note
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="p-4 border-b border-skribble-azure/20 bg-skribble-dark/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-skribble-azure mb-2">Status</label>
                  <div className="space-y-1">
                    {['pending', 'in-progress', 'resolved', 'approved'].map(status => (
                      <label key={status} className="flex items-center gap-2 text-sm text-skribble-sky">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({ ...prev, status: [...prev.status, status] }));
                            } else {
                              setFilters(prev => ({ ...prev, status: prev.status.filter(s => s !== status) }));
                            }
                          }}
                          className="rounded border-skribble-azure/30 bg-skribble-dark/50 text-skribble-azure"
                        />
                        <span className="capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-xs font-medium text-skribble-azure mb-2">Priority</label>
                  <div className="space-y-1">
                    {['low', 'medium', 'high', 'critical'].map(priority => (
                      <label key={priority} className="flex items-center gap-2 text-sm text-skribble-sky">
                        <input
                          type="checkbox"
                          checked={filters.priority.includes(priority)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({ ...prev, priority: [...prev.priority, priority] }));
                            } else {
                              setFilters(prev => ({ ...prev, priority: prev.priority.filter(p => p !== priority) }));
                            }
                          }}
                          className="rounded border-skribble-azure/30 bg-skribble-dark/50 text-skribble-azure"
                        />
                        <span className="capitalize">{priority}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-xs font-medium text-skribble-azure mb-2">Type</label>
                  <div className="space-y-1">
                    {['comment', 'marker', 'voice', 'section', 'issue', 'approval'].map(type => (
                      <label key={type} className="flex items-center gap-2 text-sm text-skribble-sky">
                        <input
                          type="checkbox"
                          checked={filters.type.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({ ...prev, type: [...prev.type, type] }));
                            } else {
                              setFilters(prev => ({ ...prev, type: prev.type.filter(t => t !== type) }));
                            }
                          }}
                          className="rounded border-skribble-azure/30 bg-skribble-dark/50 text-skribble-azure"
                        />
                        <span className="capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={fetchAnnotations}
                  className="bg-skribble-azure text-white px-3 py-1 rounded text-sm hover:bg-skribble-azure/80 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={() => {
                    setFilters({ status: [], priority: [], type: [], userId: '' });
                    fetchAnnotations();
                  }}
                  className="text-skribble-azure hover:text-skribble-sky text-sm transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Add/Edit Form */}
          {showAddForm && (
            <div ref={formRef} className="p-4 border-b border-skribble-azure/20 bg-skribble-dark/20">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Form Header */}
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-skribble-sky">
                    {editingId ? 'Edit Annotation' : replyingTo ? 'Reply to Annotation' : 'Add New Annotation'}
                  </h4>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="p-1 text-skribble-purple hover:text-skribble-azure transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Timestamp Display */}
                <div className="flex items-center gap-2 text-sm text-skribble-azure">
                  <Clock className="w-4 h-4" />
                  <span>Time: {formatTime(formData.timestamp)}</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, timestamp: currentTime }))}
                    className="text-skribble-sky hover:text-white transition-colors"
                  >
                    Use current time
                  </button>
                </div>

                {/* Form Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Annotation Type */}
                  <div>
                    <label className="block text-xs font-medium text-skribble-azure mb-1">Type</label>
                    <select
                      value={formData.annotationType}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        annotationType: e.target.value as any 
                      }))}
                      className="w-full px-3 py-2 bg-skribble-plum/50 border border-skribble-azure/30 rounded text-skribble-sky text-sm focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all"
                    >
                      <option value="comment">Comment</option>
                      <option value="marker">Marker</option>
                      <option value="voice">Voice Note</option>
                      <option value="section">Section</option>
                      <option value="issue">Issue</option>
                      <option value="approval">Approval</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-medium text-skribble-azure mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        priority: e.target.value as any 
                      }))}
                      className="w-full px-3 py-2 bg-skribble-plum/50 border border-skribble-azure/30 rounded text-skribble-sky text-sm focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Text Input */}
                <div>
                  <label className="block text-xs font-medium text-skribble-azure mb-1">Note</label>
                  <textarea
                    value={formData.text}
                    onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Add your annotation here..."
                    rows={3}
                    className="w-full px-3 py-2 bg-skribble-plum/50 border border-skribble-azure/30 rounded text-skribble-sky placeholder-skribble-purple/70 focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all resize-none"
                    required
                  />
                </div>

                {/* Form Actions */}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1 text-skribble-azure hover:text-skribble-sky transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.text.trim()}
                    className="flex items-center gap-2 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-2 rounded text-sm hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  >
                    <Send className="w-3 h-3" />
                    {editingId ? 'Update' : 'Add Note'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Annotations List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-skribble-azure" />
                <span className="ml-2 text-skribble-azure">Loading annotations...</span>
              </div>
            ) : parentAnnotations.length > 0 ? (
              <div className="space-y-3 p-4">
                {parentAnnotations.map(({ parent, replies }) => (
                  <div key={parent.id} data-annotation-id={parent.id}>
                    {/* Parent Annotation */}
                    <div className={`p-3 rounded-lg border ${getPriorityColor(parent.priority)} bg-skribble-dark/30`}>
                      {/* Annotation Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${getPriorityColor(parent.priority)}`}>
                            {getAnnotationIcon(parent.annotationType)}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-skribble-dark hover:border-skribble-azure transition-colors">
                              {parent.user.profileImage ? (
                                <Image
                                  src={getImageUrl(parent.user.profileImage)}
                                  alt={parent.user.username}
                                  title={parent.user.username}
                                  width={28}
                                  height={28}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    console.error('Failed to load user image:', getImageUrl(parent.user.profileImage));
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-skribble-plum/30 flex items-center justify-center">
                                  <User className="w-4 h-4 text-skribble-azure" />
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-skribble-sky">{parent.user.username}</span>
                            <span 
                              className="text-xs text-skribble-azure cursor-pointer hover:text-skribble-sky transition-colors"
                              onClick={() => onSeekTo(parent.timestamp)}
                            >
                              {formatTime(parent.timestamp)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(parent.status)}`}>
                              {parent.status}
                            </span>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {parent.status !== 'resolved' && (
                            <button
                              onClick={() => resolveAnnotation(parent.id)}
                              className="p-1 text-green-400 hover:text-green-300 transition-colors"
                              title="Mark as resolved"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleReply(parent)}
                            className="p-1 text-skribble-azure hover:text-skribble-sky transition-colors"
                            title="Reply"
                          >
                            <Reply className="w-3 h-3" />
                          </button>
                          {parent.userId === currentUser.id && (
                            <>
                              <button
                                onClick={() => handleEdit(parent)}
                                className="p-1 text-skribble-purple hover:text-skribble-azure transition-colors"
                                title="Edit"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteAnnotation(parent.id)}
                                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Annotation Text */}
                      <p className="text-sm text-skribble-sky leading-relaxed mb-2">
                        {parent.text}
                      </p>

                      {/* Annotation Metadata */}
                      <div className="flex items-center gap-4 text-xs text-skribble-purple">
                        <span className="capitalize">{parent.annotationType}</span>
                        <span className="capitalize">{parent.priority} priority</span>
                        <span>{new Date(parent.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="ml-8 mt-2 space-y-2">
                        {replies.map(reply => (
                          <div 
                            key={reply.id} 
                            className="p-2 rounded border border-skribble-azure/20 bg-skribble-dark/20"
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3 text-skribble-azure" />
                                <span className="text-xs font-medium text-skribble-sky">
                                  {reply.user.username}
                                </span>
                                <span 
                                  className="text-xs text-skribble-azure cursor-pointer hover:text-skribble-sky transition-colors"
                                  onClick={() => onSeekTo(reply.timestamp)}
                                >
                                  {formatTime(reply.timestamp)}
                                </span>
                              </div>
                              
                              {reply.userId === currentUser.id && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEdit(reply)}
                                    className="p-0.5 text-skribble-purple hover:text-skribble-azure transition-colors"
                                    title="Edit"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteAnnotation(reply.id)}
                                    className="p-0.5 text-red-400 hover:text-red-300 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <p className="text-xs text-skribble-sky leading-relaxed">
                              {reply.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-skribble-azure">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No annotations yet</p>
                <p className="text-sm">Click "Add Note" to create your first annotation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}