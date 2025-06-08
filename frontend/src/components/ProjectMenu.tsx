import React, { useRef, useEffect } from 'react';
import { 
  Edit3, 
  Trash2, 
  Share2,
  UserPlus,
  Calendar,
  Clock
} from 'lucide-react';

interface Project {
  id: string;
  title: string;
  deadline?: string;
  showMenu?: boolean;
  shareToken?: string;
}

interface ProjectMenuProps {
  project: Project;
  isOpen?: boolean;
  onClose: () => void;
  onDelete?: (project: Project) => void;
  onInvite?: (project: Project) => void;
  onShare?: (project: Project) => Promise<string>;
  onEdit?: (project: Project) => void;
  onSetDeadline?: (project: Project) => void; // ✨ NEW: Deadline handler
}

// Enhanced Project Menu Dropdown Component
export default function ProjectMenu({ 
  project, 
  isOpen = false, 
  onClose, 
  onEdit, 
  onDelete, 
  onInvite, 
  onShare,
  onSetDeadline 
}: ProjectMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!isOpen) return null;

  // ✨ NEW: Calculate deadline status for visual indicator
  const getDeadlineStatus = () => {
    if (!project.deadline) return null;
    
    const now = new Date();
    const deadlineDate = new Date(project.deadline);
    const timeDiff = deadlineDate.getTime() - now.getTime();
    
    if (timeDiff <= 0) return 'overdue';
    if (timeDiff <= 24 * 60 * 60 * 1000) return 'urgent'; // 24 hours
    if (timeDiff <= 3 * 24 * 60 * 60 * 1000) return 'soon'; // 3 days
    return 'normal';
  };

  const deadlineStatus = getDeadlineStatus();

  const generateViewerLink = async () => {
  try {
    const token = localStorage.getItem('skribble_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/${project.id}/viewer-link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate viewer link');
    }

    const data = await response.json();
    if (data.success) {
      const viewerUrl = `${window.location.origin}/viewer/${data.data.viewerToken}`;
      await navigator.clipboard.writeText(viewerUrl);
      alert('View-only link copied to clipboard!');
      console.log('Generated viewer URL:', viewerUrl); // For debugging
    }
  } catch (error) {
    console.error('Error generating viewer link:', error);
    alert(`Failed to generate viewer link: ${error.message}`);
  }
};

  return (
    <div className="absolute right-0 top-full mt-2 w-48 bg-skribble-plum/90 backdrop-blur-md rounded-xl border border-skribble-azure/20 shadow-lg z-50" ref={menuRef}>
      <div className="p-2 space-y-1">
        {/* ✨ NEW: Deadline section */}
        <div className="border-b border-skribble-azure/20 pb-2 mb-2">
          <button
            onClick={() => { onSetDeadline?.(project); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-skribble-sky hover:bg-skribble-azure/20 rounded-lg transition-colors text-sm"
          >
            <Calendar className="w-4 h-4" />
            {project.deadline ? 'Update Deadline' : 'Set Deadline'}
          </button>
          
          {/* ✨ NEW: Current deadline display */}
          {project.deadline && (
            <div className="px-3 py-1 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span className={`${
                  deadlineStatus === 'overdue' 
                    ? 'text-red-400' 
                    : deadlineStatus === 'urgent' 
                    ? 'text-yellow-400' 
                    : deadlineStatus === 'soon'
                    ? 'text-orange-400'
                    : 'text-green-400'
                }`}>
                  Due: {new Date(project.deadline).toLocaleDateString()} 
                  {' '}
                  {new Date(project.deadline).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Collaboration actions */}
        <button
            onClick={async () => { 
              try {
                const token = localStorage.getItem('skribble_token');
                // Make sure the token exists and is properly formatted
                if (!token) {
                  throw new Error('No authentication token found');
                }

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/${project.id}/viewer-link`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token.trim()}`,  // Make sure to use 'Bearer ' prefix
                    'Content-Type': 'application/json'
                  }
                });

                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.message || 'Failed to generate viewer link');
                }

                const data = await response.json();
                if (data.success) {
                  await navigator.clipboard.writeText(`${window.location.origin}/viewer/${data.data.viewerToken}`);
                  alert('Viewer link copied to clipboard!');
                }
              } catch (error) {
                console.error('Error generating viewer link:', error);
                alert('Failed to generate viewer link. Please try logging in again.');
              }
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-skribble-sky hover:bg-skribble-azure/20 rounded-lg transition-colors text-sm"
          >
            <Share2 onClick={generateViewerLink} className="w-4 h-4" />
            Share View-only Link
          </button>     
        
        <button
          onClick={() => { onInvite?.(project); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2 text-skribble-sky hover:bg-skribble-azure/20 rounded-lg transition-colors text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Invite Collaborators
        </button>

        <div className="border-t border-skribble-azure/20 my-1"></div>

        {/* Project management actions */}
        <button
          onClick={() => { onEdit?.(project); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2 text-skribble-sky hover:bg-skribble-azure/20 rounded-lg transition-colors text-sm"
        >
          <Edit3 className="w-4 h-4" />
          Edit Project
        </button>
        
        <button
          onClick={() => { onDelete?.(project); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          Delete Project
        </button>
      </div>
    </div>
  );
}