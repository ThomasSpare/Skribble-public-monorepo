// src/components/ProjectMenu.tsx - Mobile-Optimized Version
import React, { useEffect } from 'react';
import { Trash2, Share, Users, Calendar, X } from 'lucide-react';

// Project interface matching dashboard
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

// Mobile-compatible sharing functions
const copyToClipboardMobile = async (text: string, successMessage: string = 'Link copied to clipboard!'): Promise<boolean> => {
  try {
    // Method 1: Try native iOS share first (best UX on mobile)
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      await navigator.share({
        title: 'Skribble Project',
        text: 'Check out this music project',
        url: text
      });
      return true;
    }
    
    // Method 2: Modern Clipboard API (works in secure HTTPS contexts)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      alert(successMessage);
      return true;
    }
    
    // Method 3: Legacy clipboard method for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      alert(successMessage);
      return true;
    }
    
    throw new Error('Copy command failed');
    
  } catch (error) {
    console.error('Clipboard failed:', error);
    
    // Final fallback - show prompt dialog
    const userCopy = prompt('Copy this link manually:', text);
    return userCopy !== null;
  }
};

// Check if device is mobile
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export default function ProjectMenu({ 
  project, 
  isOpen, 
  onClose, 
  onDelete, 
  onInvite, 
  onShare,
  onSetDeadline 
}: ProjectMenuProps) {
  const isMobile = isMobileDevice();

  // Handle escape key and click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.project-menu-container')) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Mobile-optimized action handler
  const handleAction = async (action: () => Promise<void>, actionName: string) => {
    try {
      // Add haptic feedback for mobile
      if (isMobile && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      await action();
      onClose();
    } catch (error) {
      console.error(`${actionName} failed:`, error);
      onClose();
    }
  };

  // Enhanced mobile invite handler
  const handleInviteMobile = async () => {
    const token = localStorage.getItem('skribble_token');
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/${project.id}/invite-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'viewer',
          permissions: {
            canEdit: false,
            canComment: true,
            canExport: false,
            canInvite: false,
            canManageProject: false
          },
          expiresIn: 7 // days
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to generate invite link');
      }

      if (data.success && data.data.inviteLink) {
        await copyToClipboardMobile(
          data.data.inviteLink, 
          'Invite link ready to share! Send this to your collaborator.'
        );
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      alert(`Failed to generate invite link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Enhanced mobile share handler
  const handleShareMobile = async () => {
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
        await copyToClipboardMobile(viewerUrl, 'View-only link ready to share!');
      }
    } catch (error) {
      console.error('Error generating viewer link:', error);
      alert(`Failed to generate viewer link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Mobile-specific styles and layout
  const menuClasses = isMobile 
    ? "fixed inset-x-4 bottom-4 bg-skribble-plum border border-skribble-azure/20 rounded-2xl shadow-2xl z-50 mobile-sheet animate-slide-up"
    : "absolute right-8 bottom-0 w-48 bg-skribble-plum border border-skribble-azure/20 rounded-lg shadow-xl z-50";

  const buttonClasses = isMobile
    ? "w-full px-6 py-4 text-left transition-colors flex items-center gap-3 text-base"
    : "w-full px-4 py-2 text-left transition-colors flex items-center gap-2";

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
      
      <div className={`project-menu-container ${menuClasses}`}>
        {/* Mobile header */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b border-skribble-azure/10">
            <h3 className="text-lg font-medium text-skribble-sky">Project Actions</h3>
            <button
              onClick={onClose}
              className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className={isMobile ? "py-2" : "py-2"}>
          <button
            onClick={() => handleAction(async () => {
              if (isMobile) {
                await handleInviteMobile();
              } else {
                await onInvite(project);
              }
            }, 'Create Collaborator Link')}
            className={`${buttonClasses} text-skribble-azure hover:bg-skribble-azure/10 hover:text-skribble-sky`}
          >
            <Users className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
            Create Collaborator Link
          </button>
          
          <button
            onClick={() => handleAction(async () => {
              if (isMobile) {
                await handleShareMobile();
              } else {
                await onShare(project);
              }
            }, 'Create View-Only Link')}
            className={`${buttonClasses} text-skribble-azure hover:bg-skribble-azure/10 hover:text-skribble-sky`}
          >
            <Share className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
            Create View-Only Link
          </button>

          {onSetDeadline && (
            <button
              onClick={() => handleAction(() => onSetDeadline(project), 'Set Deadline')}
              className={`${buttonClasses} text-skribble-azure hover:bg-skribble-azure/10 hover:text-skribble-sky`}
            >
              <Calendar className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
              Set Deadline
            </button>
          )}
          
          <div className="border-t border-skribble-azure/10 my-1"></div>
          
          <button
            onClick={() => handleAction(() => onDelete(project), 'Delete Project')}
            className={`${buttonClasses} text-red-400 hover:bg-red-500/10 hover:text-red-300`}
          >
            <Trash2 className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
            Delete Project
          </button>
        </div>

        {/* Mobile safe area padding */}
        {isMobile && (
          <div className="h-safe-bottom"></div>
        )}
      </div>
    </>
  );
}