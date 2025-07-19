'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  EyeOff,
  Mic,
  Play,
  Pause
} from 'lucide-react';
import Image from 'next/image';
import SoundMonitor from './SoundMonitor';
import VoiceNoteRecorder from './VoiceNoteRecorder';
import VoiceNotePlayer from './VoiceNotePlayer';
import { getImageUrl } from '@/utils/images';
import { generateEnhancedReaperProject } from '@/lib/reaperExportEnhanced';

// Types
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

interface ExportButtonProps {
  annotations: AnnotationType[];
  audioUrl?: string;
  projectTitle?: string;
  audioFileName?: string;
  userTier?: string;
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
  // Export props
  audioUrl?: string;
  projectTitle?: string;
  audioFileName?: string;
  userTier?: string;
}

interface AnnotationFormData {
  text: string;
  annotationType: 'comment' | 'marker' | 'voice' | 'section' | 'issue' | 'approval';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  parentId?: string;
}

interface AnnotationItemProps {
  annotation: AnnotationType;
  onSeekTo: (timestamp: number) => void;
  onEdit: (annotation: AnnotationType) => void;
  onDelete: (annotationId: string) => void;
  onReply: (annotation: AnnotationType) => void;
  onResolve: (annotationId: string) => void;
  onStatusChange: (annotationId: string, status: string) => void;
  currentUser: any;
  replies: AnnotationType[];
  isNested?: boolean;
}

// Enhanced Export Button Component
function ExportButton({ annotations, audioUrl, projectTitle, audioFileName, userTier = 'free' }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const canExportVoiceNotes = ['producer', 'studio'].includes(userTier);
  const hasVoiceNotes = annotations.some(a => a.voiceNoteUrl);

  const handleExport = async (includeVoiceNotes: boolean = false) => {
    if (!audioUrl || !projectTitle || !audioFileName) {
      alert('Missing export data. Please try again.');
      return;
    }

    if (!canExportVoiceNotes && includeVoiceNotes) {
      alert('Voice note export requires Producer tier subscription.');
      return;
    }

    setIsExporting(true);
    try {
      await generateEnhancedReaperProject(audioUrl, annotations, {
        projectTitle,
        originalAudioFileName: audioFileName,
        includeVoiceNotes,
        userTier
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setShowExportOptions(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowExportOptions(!showExportOptions)}
        disabled={isExporting || annotations.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 
                 disabled:bg-green-500/50 disabled:cursor-not-allowed
                 text-white rounded-lg transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Music className="w-4 h-4" />
            Export to Reaper
            <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>

      {showExportOptions && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-skribble-plum/90 backdrop-blur-md 
                       rounded-xl border border-skribble-azure/20 p-3 z-50">
          <div className="space-y-3">
            <h4 className="text-white font-medium">Export Options</h4>
            
            {/* Basic Export */}
            <button
              onClick={() => handleExport(false)}
              className="w-full text-left p-3 bg-skribble-dark-plum/30 hover:bg-skribble-dark-plum/50 
                       rounded-lg transition-colors"
            >
              <div className="text-white font-medium">📄 Basic Export</div>
              <div className="text-skribble-azure/60 text-sm">
                Reaper project + audio file + markers
              </div>
            </button>

            {/* Voice Notes Export */}
            <button
              onClick={() => handleExport(true)}
              disabled={!canExportVoiceNotes || !hasVoiceNotes}
              className="w-full text-left p-3 bg-skribble-dark-plum/30 hover:bg-skribble-dark-plum/50 
                       disabled:bg-skribble-dark-plum/20 disabled:cursor-not-allowed
                       rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-medium">🎤 Full Export with Voice Notes</div>
                {!canExportVoiceNotes && (
                  <span className="text-orange-400 text-xs px-2 py-1 bg-orange-400/20 rounded">
                    PRO
                  </span>
                )}
              </div>
              <div className="text-skribble-azure/60 text-sm">
                {!canExportVoiceNotes 
                  ? 'Requires Producer tier - upgrade to export voice recordings'
                  : hasVoiceNotes
                    ? 'Includes voice note audio tracks positioned automatically'
                    : 'No voice notes found in this project'
                }
              </div>
            </button>

            {/* Tier Upgrade Notice */}
            {!canExportVoiceNotes && (
              <div className="p-3 bg-orange-500/20 border border-orange-500/40 rounded-lg">
                <p className="text-orange-200 text-sm">
                  💡 <strong>Upgrade to Producer tier</strong> to export voice note audio files directly to Reaper tracks!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// AnnotationItem Component
function AnnotationItem({ 
  annotation, 
  onSeekTo, 
  onEdit, 
  onDelete, 
  onReply, 
  onResolve, 
  onStatusChange,
  currentUser, 
  replies,
  isNested = false
}: AnnotationItemProps) {
  
  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'issue': return <AlertTriangle className="w-4 h-4" />;
      case 'approval': return <CheckCircle className="w-4 h-4" />;
      case 'marker': return <Flag className="w-4 h-4" />;
      case 'section': return <Edit3 className="w-4 h-4" />;
      case 'voice': return <Mic className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 border-red-400 bg-red-400/10';
      case 'high': return 'text-orange-400 border-orange-400 bg-orange-400/10';
      case 'medium': return 'text-yellow-400 border-yellow-400 bg-yellow-400/10';
      case 'low': return 'text-green-400 border-green-400 bg-green-400/10';
      default: return 'text-skribble-azure border-skribble-azure bg-skribble-azure/10';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-500/20 text-green-200 border-green-500/40';
      case 'approved': return 'bg-blue-500/20 text-blue-200 border-blue-500/40';
      case 'in-progress': return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40';
      default: return 'bg-skribble-azure/20 text-skribble-azure border-skribble-azure/40';
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const canEdit = annotation.userId === currentUser.id;
  const canResolve = annotation.status !== 'resolved' && !isNested;
  const showReplyButton = !isNested;

  return (
    <div className={`
      bg-skribble-plum/20 backdrop-blur-sm rounded-lg border border-skribble-azure/10 p-4
      ${isNested ? 'ml-4 mt-3' : ''}
      hover:border-skribble-azure/20 transition-colors
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          <div className="relative">
            <img
              src={annotation.user?.profileImage || '/api/placeholder/32/32'}
              alt={annotation.user?.username || 'User'}
              className="w-8 h-8 rounded-full border border-skribble-azure/20"
              onError={(e) => {
                e.currentTarget.src = '/api/placeholder/32/32';
              }}
            />
            {annotation.user?.role === 'producer' && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-skribble-azure rounded-full border border-skribble-dark-plum" 
                   title="Producer" />
            )}
          </div>
          
          {/* User Info */}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white font-medium">{annotation.user?.username || 'Unknown User'}</p>
              {annotation.user?.subscriptionTier === 'producer' && (
                <span className="text-xs bg-skribble-azure/20 text-skribble-azure px-2 py-0.5 rounded-full">
                  Producer
                </span>
              )}
            </div>
            <p className="text-skribble-azure/60 text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(annotation.createdAt)}
              {annotation.updatedAt !== annotation.createdAt && (
                <span className="text-skribble-azure/40">(edited)</span>
              )}
            </p>
          </div>
        </div>

        {/* Right side badges */}
        <div className="flex items-center gap-2">
          {/* Timestamp Button */}
          <button
            onClick={() => onSeekTo(annotation.timestamp)}
            className="px-2 py-1 bg-skribble-azure/20 text-skribble-azure rounded text-sm 
                     hover:bg-skribble-azure/30 transition-colors flex items-center gap-1"
            title="Jump to this timestamp"
          >
            <span>⏱</span>
            {formatTime(annotation.timestamp)}
          </button>

          {/* Type & Priority Badge */}
          <div className={`flex items-center gap-1 px-2 py-1 border rounded text-xs ${getPriorityColor(annotation.priority)}`}>
            {getAnnotationIcon(annotation.annotationType)}
            <span className="capitalize">{annotation.annotationType}</span>
            {annotation.priority !== 'medium' && (
              <span className="text-xs opacity-80">({annotation.priority})</span>
            )}
          </div>

          {/* Status Badge */}
          <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(annotation.status)}`}>
            {annotation.status === 'in-progress' ? 'In Progress' : 
             annotation.status.charAt(0).toUpperCase() + annotation.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        {/* Text Content */}
        <div className="text-white leading-relaxed">
          {annotation.text}
        </div>
        
        {/* Voice Note Player */}
        {annotation.voiceNoteUrl && (
          <VoiceNotePlayer 
            voiceNoteUrl={annotation.voiceNoteUrl}
            annotation={annotation}
            onSeekTo={onSeekTo}
            className="mt-3"
          />
        )}

        {/* Mentions */}
        {annotation.mentions && annotation.mentions.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-skribble-azure/60">
            <span>@</span>
            <span>Mentions: {annotation.mentions.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Reply Button */}
          {showReplyButton && (
            <button
              onClick={() => onReply(annotation)}
              className="flex items-center gap-1 px-3 py-1 text-skribble-azure hover:bg-skribble-azure/10 
                       rounded text-sm transition-colors"
            >
              <Reply className="w-3 h-3" />
              Reply {replies.length > 0 && `(${replies.length})`}
            </button>
          )}

          {/* Status Change Buttons */}
          {canResolve && (
            <div className="flex items-center gap-1">
              {annotation.status === 'pending' && (
                <button
                  onClick={() => onStatusChange(annotation.id, 'in-progress')}
                  className="flex items-center gap-1 px-3 py-1 text-yellow-400 hover:bg-yellow-400/10 
                           rounded text-sm transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  Start
                </button>
              )}
              
              <button
                onClick={() => onResolve(annotation.id)}
                className="flex items-center gap-1 px-3 py-1 text-green-400 hover:bg-green-400/10 
                         rounded text-sm transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                {annotation.status === 'in-progress' ? 'Complete' : 'Resolve'}
              </button>
            </div>
          )}
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-1">
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(annotation)}
                className="p-2 text-skribble-azure/60 hover:text-skribble-azure hover:bg-skribble-azure/10 
                         rounded transition-colors"
                title="Edit annotation"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(annotation.id)}
                className="p-2 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 
                         rounded transition-colors"
                title="Delete annotation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-4 space-y-3 border-l-2 border-skribble-azure/20 pl-4">
          <div className="text-xs text-skribble-azure/60 font-medium">
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </div>
          {replies.map(reply => (
            <AnnotationItem
              key={reply.id}
              annotation={reply}
              onSeekTo={onSeekTo}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={onReply}
              onResolve={onResolve}
              onStatusChange={onStatusChange}
              currentUser={currentUser}
              replies={[]}
              isNested={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Main AnnotationSystem Component
export default function AnnotationSystem({ 
  audioFileId, 
  currentTime, 
  onSeekTo,
  currentUser,
  onAnnotationDeleted,
  onAnnotationCreated,
  onAnnotationUpdated,
  // New props for SoundMonitor integration
  analyser,
  isPlaying = false,
  audioBuffer,
  // Export props
  audioUrl,
  projectTitle,
  audioFileName,
  userTier = 'free'
}: AnnotationSystemProps) {
  // State
  const [annotations, setAnnotations] = useState<AnnotationType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
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

  // SoundMonitor state
  const [showSoundMonitor, setShowSoundMonitor] = useState(true);
  const [detectedTempo, setDetectedTempo] = useState<number>(0);
  const [detectedKey, setDetectedKey] = useState<string>('');

  const formRef = useRef<HTMLDivElement>(null);

  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageCircle className="w-3 h-3" />;
      case 'issue': return <AlertTriangle className="w-3 h-3" />;
      case 'approval': return <CheckCircle className="w-3 h-3" />;
      case 'marker': return <Flag className="w-3 h-3" />;
      case 'section': return <Edit3 className="w-3 h-3" />;
      case 'voice': return <Mic className="w-3 h-3" />;
      default: return <MessageCircle className="w-3 h-3" />;
    }
  };

  // Update timestamp when currentTime changes
  useEffect(() => {
    if (showAddForm && !editingId && !replyingTo) {
      setFormData(prev => ({ ...prev, timestamp: currentTime }));
    }
  }, [currentTime, showAddForm, editingId, replyingTo]);

  const fetchAnnotations = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('skribble_token');
      if (!token) {
        console.warn('No auth token found');
        return;
      }

      const queryParams = new URLSearchParams();
      
      // Add filter parameters
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

      if (!response.ok) {
        if (response.status === 401) {
          // Handle auth error
          localStorage.removeItem('skribble_token');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAnnotations(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch annotations');
      }
    } catch (error) {
      console.error('Error fetching annotations:', error);
      // You might want to show a toast notification here
    } finally {
      setIsLoading(false);
    }
  }, [audioFileId, filters]);

  // Fetch annotations
  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  // Handle cancel
  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
    setReplyingTo(null);
    setShowVoiceRecorder(false);
    setFormData({
      text: '',
      annotationType: 'comment',
      priority: 'medium',
      timestamp: currentTime,
      parentId: undefined
    });
  };

  // Utility functions
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle voice note creation
  const handleVoiceNoteCreated = useCallback(async (audioBlob: Blob, duration: number) => {
    setIsUploadingVoice(true);
    
    try {
      // Validate inputs
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Invalid audio data');
      }

      const formDataUpload = new FormData();
      formDataUpload.append('voiceNote', audioBlob, 'voice-note.webm');
      formDataUpload.append('audioFileId', audioFileId);
      formDataUpload.append('timestamp', formData.timestamp.toString());
      formDataUpload.append('text', formData.text || `Voice note at ${formatTime(formData.timestamp)}`);
      formDataUpload.append('annotationType', 'voice');
      formDataUpload.append('priority', formData.priority);

      // Add parent ID if this is a reply
      if (replyingTo) {
        formDataUpload.append('parentId', replyingTo);
      }

      const token = localStorage.getItem('skribble_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voice-notes/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataUpload
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Upload failed');
      }
      
      // Reset form and close voice recorder
      setShowVoiceRecorder(false);
      handleCancel();
      
      // Refresh annotations
      await fetchAnnotations();
      
      console.log('✅ Voice note uploaded successfully:', result.data.annotation.id);
      
      // Trigger callback if provided
      if (onAnnotationCreated) {
        onAnnotationCreated(result.data.annotation);
      }
      
    } catch (error) {
      console.error('❌ Failed to upload voice note:', error);
      
      // Show specific error messages
      let errorMessage = 'Failed to upload voice note. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Authentication')) {
          errorMessage = 'Please log in again to upload voice notes.';
        } else if (error.message.includes('size')) {
          errorMessage = 'Voice note file is too large. Please record a shorter message.';
        } else if (error.message.includes('format')) {
          errorMessage = 'Unsupported audio format. Please try again.';
        }
      }
      
      alert(errorMessage);
      
    } finally {
      setIsUploadingVoice(false);
    }
  }, [audioFileId, formData, replyingTo, onAnnotationCreated, fetchAnnotations, handleCancel, formatTime]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showExportOptions && !target.closest('.export-options-container')) {
        setShowExportOptions(false);
      }
    };

    if (showExportOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportOptions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit form
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && showAddForm) {
        const form = document.querySelector('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
      
      // Escape to cancel form
      if (event.key === 'Escape' && showAddForm) {
        handleCancel();
      }
      
      // 'a' key to add annotation (when not typing)
      if (
        event.key === 'a' &&
        !showAddForm &&
        !(event.target instanceof Element && event.target.closest('input, textarea'))
      ) {
        setShowAddForm(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAddForm, handleCancel]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.text.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('skribble_token');
      const url = editingId 
        ? `${process.env.NEXT_PUBLIC_API_URL}/annotations/${editingId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/annotations`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        audioFileId: editingId ? undefined : audioFileId,
        userId: editingId ? undefined : currentUser.id
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        handleCancel();
        fetchAnnotations();
        
        if (editingId && onAnnotationUpdated) {
          onAnnotationUpdated(data.data);
        } else if (!editingId && onAnnotationCreated) {
          onAnnotationCreated(data.data);
        }
      }
    } catch (error) {
      console.error('Error submitting annotation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle annotation deletion
  const handleDelete = async (annotationId: string) => {
    if (!confirm('Are you sure you want to delete this annotation?')) {
      return;
    }

    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/annotations/${annotationId}`, {
        method: 'DELETE',
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
        setAnnotations(prev => prev.filter(a => a.id !== annotationId));
        
        if (onAnnotationDeleted) {
          onAnnotationDeleted(annotationId);
        }
      }
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  };

  // Handle resolve annotation
  const handleResolve = async (annotationId: string) => {
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        fetchAnnotations();
        
        if (onAnnotationUpdated) {
          onAnnotationUpdated(data.data);
        }
      }
    } catch (error) {
      console.error('Error resolving annotation:', error);
    }
  };

  // Handle status change
  const handleStatusChange = async (annotationId: string, status: string) => {
    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/annotations/${annotationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        fetchAnnotations();
        
        if (onAnnotationUpdated) {
          onAnnotationUpdated(data.data);
        }
      }
    } catch (error) {
      console.error('Error updating annotation status:', error);
    }
  };

  const handleReply = (annotation: AnnotationType) => {
    setReplyingTo(annotation.id);
    setFormData({
      text: '',
      annotationType: 'comment',
      priority: 'medium',
      timestamp: annotation.timestamp,
      parentId: annotation.id
    });
    setShowAddForm(true);
  };

  const handleEdit = (annotation: AnnotationType) => {
    setEditingId(annotation.id);
    setFormData({
      text: annotation.text,
      annotationType: annotation.annotationType,
      priority: annotation.priority,
      timestamp: annotation.timestamp,
      parentId: annotation.parentId
    });
    setShowAddForm(true);
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
            
            {analyser && (
              <SoundMonitor
                analyser={analyser}
                isPlaying={isPlaying}
                audioBuffer={audioBuffer}
                onTempoDetected={setDetectedTempo}
                onKeyDetected={setDetectedKey}
              />
            )}
            
            {(detectedTempo > 0 || detectedKey) && (
              <div className="mt-4 p-3 bg-skribble-dark-plum/30 rounded-lg">
                <h4 className="text-skribble-azure font-medium mb-2">Detected:</h4>
                {detectedTempo > 0 && (
                  <p className="text-white text-sm">🥁 Tempo: {detectedTempo} BPM</p>
                )}
                {detectedKey && (
                  <p className="text-white text-sm">🎹 Key: {detectedKey}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Column - Annotations */}
      <div className={`${showSoundMonitor ? 'lg:w-1/2' : 'w-full'} space-y-4`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-skribble-azure" />
              Annotations ({annotations.length})
            </h2>
            
            {!showSoundMonitor && (
              <button
                onClick={() => setShowSoundMonitor(true)}
                className="p-2 rounded-lg text-skribble-azure/60 hover:text-skribble-azure transition-colors"
                title="Show Sound Monitor"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Export Button */}
            {audioUrl && projectTitle && audioFileName && (
              <ExportButton
                annotations={annotations}
                audioUrl={audioUrl}
                projectTitle={projectTitle}
                audioFileName={audioFileName}
                userTier={userTier}
              />
            )}
            
            {/* Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 rounded-lg text-skribble-azure/60 hover:text-skribble-azure transition-colors"
              title="Filter annotations"
            >
              <Filter className="w-5 h-5" />
            </button>
            
            {/* Add Annotation */}
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-skribble-plum/30 hover:bg-skribble-azure/80 
                       text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Annotation
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl border border-skribble-azure/20 p-4">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-skribble-azure" />
              Filters
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-skribble-azure/80 mb-2">
                  Status
                </label>
                <div className="space-y-2">
                  {['pending', 'in-progress', 'resolved', 'approved'].map(status => (
                    <label key={status} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              status: [...prev.status, status]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              status: prev.status.filter(s => s !== status)
                            }));
                          }
                        }}
                        className="rounded border-skribble-azure/20"
                      />
                      <span className="text-white text-sm capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-skribble-azure/80 mb-2">
                  Priority
                </label>
                <div className="space-y-2">
                  {['low', 'medium', 'high', 'critical'].map(priority => (
                    <label key={priority} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.priority.includes(priority)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              priority: [...prev.priority, priority]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              priority: prev.priority.filter(p => p !== priority)
                            }));
                          }
                        }}
                        className="rounded border-skribble-azure/20"
                      />
                      <span className="text-white text-sm capitalize">{priority}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-skribble-azure/80 mb-2">
                  Type
                </label>
                <div className="space-y-2">
                  {['comment', 'voice', 'issue', 'approval', 'marker', 'section'].map(type => (
                    <label key={type} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.type.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              type: [...prev.type, type]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              type: prev.type.filter(t => t !== type)
                            }));
                          }
                        }}
                        className="rounded border-skribble-azure/20"
                      />
                      <span className="text-white text-sm flex items-center gap-1">
                        {getAnnotationIcon(type)}
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* User Filter */}
              <div>
                <label className="block text-sm font-medium text-skribble-azure/80 mb-2">
                  User
                </label>
                <select
                  value={filters.userId}
                  onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-3 py-2 bg-skribble-dark-plum/50 border border-skribble-azure/20 
                           rounded-lg text-white focus:outline-none focus:border-skribble-azure"
                >
                  <option value="">All Users</option>
                  {[...new Set(annotations.map(a => a.user))].map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setFilters({
                    status: [],
                    priority: [],
                    type: [],
                    userId: ''
                  });
                  fetchAnnotations();
                }}
                className="px-4 py-2 text-skribble-azure hover:bg-skribble-azure/10 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl border border-skribble-azure/20 p-4 relative">
            {showVoiceRecorder ? (
              <VoiceNoteRecorder
                onVoiceNoteCreated={handleVoiceNoteCreated}
                onCancel={() => setShowVoiceRecorder(false)}
                maxDuration={120}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">
                    {editingId ? 'Edit Annotation' : replyingTo ? 'Add Reply' : 'Add Annotation'}
                  </h3>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="p-2 rounded-lg text-skribble-azure/60 hover:text-skribble-azure transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <textarea
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    placeholder="Enter your feedback or comment..."
                    className="w-full h-24 px-3 py-2 bg-skribble-plum/30 border border-skribble-azure/20 
                             rounded-lg text-white placeholder-skribble-azure/40 resize-none
                             focus:outline-none focus:border-skribble-azure"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-skribble-azure/80 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.annotationType}
                      onChange={(e) => setFormData({ ...formData, annotationType: e.target.value as any })}
                      className="w-full px-3 py-2 bg-skribble-plum/30 border border-skribble-azure/20 
                               rounded-lg text-white focus:outline-none focus:border-skribble-azure"
                    >
                      <option value="comment">💬 Comment</option>
                      <option value="issue">⚠️ Issue</option>
                      <option value="approval">✅ Approval</option>
                      <option value="marker">📍 Marker</option>
                      <option value="section">🎵 Section</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-skribble-azure/80 mb-1">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full px-3 py-2 bg-skribble-plum/30 border border-skribble-azure/20 
                               rounded-lg text-white focus:outline-none focus:border-skribble-azure"
                    >
                      <option value="low">🟢 Low</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="high">🟠 High</option>
                      <option value="critical">🔴 Critical</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-skribble-dark-plum/30 rounded-lg">
                  <span className="text-skribble-azure/80 text-sm">Timestamp:</span>
                  <span className="text-white font-mono">
                    {Math.floor(formData.timestamp / 60)}:{(formData.timestamp % 60).toFixed(1).padStart(4, '0')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowVoiceRecorder(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 
                               text-white rounded-lg transition-colors text-sm"
                    >
                      <Mic className="w-4 h-4" />
                      Voice Note
                    </button>

                    <div className="text-xs text-skribble-azure/50">
                      💡 Record voice feedback for clearer communication
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 text-skribble-azure/80 hover:text-skribble-azure transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !formData.text.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-skribble-azure hover:bg-skribble-azure/80 
                               disabled:bg-skribble-azure/50 disabled:cursor-not-allowed
                               text-white rounded-lg transition-colors"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          {editingId ? 'Update' : 'Add'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
            
            {isUploadingVoice && (
              <div className="absolute inset-0 bg-skribble-plum/50 backdrop-blur-sm rounded-xl 
                             flex items-center justify-center z-10">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-skribble-azure mx-auto mb-2" />
                  <p className="text-white">Uploading voice note...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Annotations List */}
        <div className="space-y-4">
          {parentAnnotations.map(({ parent, replies }) => (
            <AnnotationItem
              key={parent.id}
              annotation={parent}
              onSeekTo={onSeekTo}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReply={handleReply}
              onResolve={handleResolve}
              onStatusChange={handleStatusChange}
              currentUser={currentUser}
              replies={replies}
              isNested={false}
            />
          ))}
        </div>

        {/* Empty State */}
        {annotations.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-skribble-azure/40 mx-auto mb-4" />
            <p className="text-skribble-azure/60 mb-2">No annotations yet</p>
            <p className="text-skribble-azure/40 text-sm mb-4">Click "Add Annotation" to start collaborating</p>
            <div className="flex items-center justify-center gap-4 text-xs text-skribble-azure/30">
              <span>💬 Text comments</span>
              <span>🎤 Voice notes</span>
              <span>📍 Markers</span>
              <span>⚠️ Issues</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}