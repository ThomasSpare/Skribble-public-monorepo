// AnnotationItem.tsx
'use client';
import React from 'react';
import { 
  MessageCircle, 
  Flag, 
  CheckCircle, 
  AlertTriangle,
  Edit3,
  Trash2,
  Reply,
  User,
  Mic,
  Clock,
  MoreHorizontal
} from 'lucide-react';
import VoiceNotePlayer from './VoiceNotePlayer';

interface AnnotationItemProps {
  annotation: any;
  onSeekTo: (timestamp: number) => void;
  onEdit: (annotation: any) => void;
  onDelete: (annotationId: string) => void;
  onReply: (annotation: any) => void;
  onResolve: (annotationId: string) => void;
  onStatusChange: (annotationId: string, status: string) => void;
  currentUser: any;
  replies: any[];
  isNested?: boolean;
}

export default function AnnotationItem({ 
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