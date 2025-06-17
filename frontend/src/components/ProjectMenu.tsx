// src/components/ProjectMenu.tsx - Updated interface

import React from 'react';
import { MoreVertical, Trash2, Share, Users, Calendar } from 'lucide-react';

// Updated Project interface to match dashboard
interface Project {
  id: string;
  title: string;
  creatorId?: string;
  creator?: {
    username: string;
  };
  collaborators?: any[];
  audioFiles?: any[];
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  shareLink?: string;
  deadline?: string;
  annotations?: number;
  lastUpdated?: string;
  duration?: string;
  showMenu?: boolean;
}

interface ProjectMenuProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (project: Project) => Promise<void>;
  onInvite: (project: Project) => Promise<void>;
  onShare: (project: Project) => Promise<void>;
  onSetDeadline?: (project: Project) => Promise<void>;
}

export default function ProjectMenu({ 
  project, 
  isOpen, 
  onClose, 
  onDelete, 
  onInvite, 
  onShare,
  onSetDeadline 
}: ProjectMenuProps) {
  if (!isOpen) return null;

  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
      onClose();
    } catch (error) {
      console.error('Action failed:', error);
      onClose();
    }
  };

  return (
    <div className="absolute right-0 top-8 w-48 bg-skribble-plum border border-skribble-azure/20 rounded-lg shadow-xl z-50">
      <div className="py-2">
        <button
          onClick={() => handleAction(() => onInvite(project))}
          className="w-full px-4 py-2 text-left text-skribble-azure hover:bg-skribble-azure/10 hover:text-skribble-sky transition-colors flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          Create Collaborator link
        </button>
        
        <button
          onClick={() => handleAction(() => onShare(project))}
          className="w-full px-4 py-2 text-left text-skribble-azure hover:bg-skribble-azure/10 hover:text-skribble-sky transition-colors flex items-center gap-2"
        >
          <Share className="w-4 h-4" />
          Create View-Only link
        </button>

        {onSetDeadline && (
          <button
            onClick={() => handleAction(() => onSetDeadline(project))}
            className="w-full px-4 py-2 text-left text-skribble-azure hover:bg-skribble-azure/10 hover:text-skribble-sky transition-colors flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Set Deadline
          </button>
        )}
        
        <div className="border-t border-skribble-azure/10 my-1"></div>
        
        <button
          onClick={() => handleAction(() => onDelete(project))}
          className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Project
        </button>
      </div>
    </div>
  );
}