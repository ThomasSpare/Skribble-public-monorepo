// frontend/src/utils/annotations.ts
/**
 * Helper functions for annotations
 */

// Format timestamp in minutes:seconds
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Get icon component based on annotation type
export const getAnnotationIcon = (type: string) => {
  switch (type) {
    case 'issue': return 'AlertTriangle';
    case 'approval': return 'CheckCircle';
    case 'marker': return 'Flag';
    case 'section': return 'Edit3';
    default: return 'MessageCircle';
  }
};

// Get color classes based on priority
export const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'text-red-400 border-red-400';
    case 'high': return 'text-orange-400 border-orange-400';
    case 'medium': return 'text-yellow-400 border-yellow-400';
    case 'low': return 'text-green-400 border-green-400';
    default: return 'text-skribble-azure border-skribble-azure';
  }
};

// Get color classes based on status
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'resolved': return 'bg-green-500/20 text-green-200';
    case 'approved': return 'bg-blue-500/20 text-blue-200';
    case 'in-progress': return 'bg-yellow-500/20 text-yellow-200';
    default: return 'bg-skribble-azure/20 text-skribble-azure';
  }
};
