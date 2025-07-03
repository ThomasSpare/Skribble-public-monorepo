// frontend/src/components/CollaboratorsMenu.tsx
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { getImageUrl } from '@/utils/images';
import { 
  X, 
  Users, 
  Crown, 
  UserMinus, 
  Mail,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import Image from 'next/image';
import UserAvatar from './userAvatar';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  profileImage?: string;
  createdAt: string;
}

interface Collaborator {
  id: string;
  projectId: string;
  userId: string;
  user: User;
  ProfileImage?: string;
  role: 'producer' | 'artist' | 'viewer' | 'admin';
  permissions: {
    canEdit: boolean;
    canComment: boolean;
    canExport: boolean;
    canInvite: boolean;
    canManageProject: boolean;
  };
  invitedBy?: string;
  inviterName?: string;
  invitedAt: string;
  acceptedAt?: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface CollaboratorsMenuProps {
  projectId: string;
  currentUserId: string;
  isProjectCreator: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRemoveCollaborator?: (collaboratorId: string) => void;
}

export default function CollaboratorsMenu({ 
  projectId, 
  currentUserId,
  isProjectCreator, 
  isOpen, 
  onClose,
  onRemoveCollaborator 
}: CollaboratorsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [projectCreator, setProjectCreator] = useState<User | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Fetch collaborators when menu opens
  useEffect(() => {
    if (isOpen && projectId) {
      fetchCollaborators();
    }
  }, [isOpen, projectId]);

  
 // Modified fetchCollaborators function to also fetch project creator
const fetchCollaborators = async () => {
  setIsLoading(true);
  setError(null);

  try {
    const token = localStorage.getItem('skribble_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Fetch both project details (for creator) and collaborators
    const [projectResponse, collaboratorsResponse] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/${projectId}/collaborators`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    if (!projectResponse.ok || !collaboratorsResponse.ok) {
      const projectError = !projectResponse.ok ? await projectResponse.text() : '';
      const collabError = !collaboratorsResponse.ok ? await collaboratorsResponse.text() : '';
      console.error('API Responses:', { projectError, collabError });
      throw new Error(`Failed to fetch project data. Project: ${projectResponse.status}, Collaborators: ${collaboratorsResponse.status}`);
    }

    const projectData = await projectResponse.json();
    const collaboratorsData = await collaboratorsResponse.json();

    if (projectData.success && collaboratorsData.success) {
      setProjectCreator(projectData.data.creator);
      // Filter out creator from collaborators list if they appear there
      const filteredCollaborators = collaboratorsData.data.filter(
        (collab: Collaborator) => collab.userId !== projectData.data.creatorId
      );
      setCollaborators(filteredCollaborators);
    } else {
      throw new Error(`API Error - Project: ${projectData.error?.message}, Collaborators: ${collaboratorsData.error?.message}`);
    }
  } catch (error) {
    console.error('Error fetching project data:', error);
    setError(error instanceof Error ? error.message : 'Failed to load collaborators');
  } finally {
    setIsLoading(false);
  }
};

  const handleRemoveCollaborator = async (collaborator: Collaborator) => {
    if (!isProjectCreator) return;
    
    const confirmMessage = `Remove ${collaborator.user.username} from this project?`;
    if (!confirm(confirmMessage)) return;

    setRemovingIds(prev => new Set(prev).add(collaborator.id));

    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/${projectId}/collaborators/${collaborator.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await response.json();
      if (data.success) {
        setCollaborators(prev => prev.filter(c => c.id !== collaborator.id));
        onRemoveCollaborator?.(collaborator.id);
      } else {
        throw new Error(data.error?.message || 'Failed to remove collaborator');
      }
    } catch (error: any) {
      console.error('Error removing collaborator:', error);
      alert(error.message || 'Failed to remove collaborator');
    } finally {
      setRemovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(collaborator.id);
        return newSet;
      });
    }
  };

  const getRoleDisplay = (role: string) => {
    const roleMap: { [key: string]: { label: string; color: string } } = {
      'admin': { label: 'Admin', color: 'text-red-400' },
      'producer': { label: 'Producer', color: 'text-skribble-azure' },
      'artist': { label: 'Artist', color: 'text-purple-400' },
      'viewer': { label: 'Viewer', color: 'text-skribble-sky' }
    };
    return roleMap[role] || { label: role, color: 'text-skribble-azure' };
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      'accepted': { label: 'Active', color: 'text-green-400' },
      'pending': { label: 'Pending', color: 'text-yellow-400' },
      'declined': { label: 'Declined', color: 'text-red-400' }
    };
    return statusMap[status] || { label: status, color: 'text-skribble-azure' };
  };

  const CreatorDisplay = ({ creator }: { creator: User }) => (
    <div className="p-3 bg-skribble-azure/5 border-b border-skribble-azure/20">
      <div className="flex items-center gap-3">
        {/* Profile Image */}
        <div className="w-10 h-10 rounded-full overflow-hidden bg-skribble-azure/20 flex-shrink-0">
          {creator.profileImage ? (
            <UserAvatar 
                user={creator}
                size="md"
                showFallbackIcon={false} // Show initials for better identification
              />
          ) : (
            <div className="w-full h-full bg-skribble-azure/20 flex items-center justify-center">
              <span className="text-skribble-azure font-medium text-sm">
                {creator.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Creator Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-skribble-azure truncate">
              {creator.username}
            </p>
            <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          </div>
          <p className="text-xs text-skribble-azure/70">Project Creator</p>
          <p className="text-xs text-skribble-azure/60 truncate mt-1">
            {creator.email}
          </p>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-skribble-plum/90 backdrop-blur-md rounded-xl border border-skribble-azure/20 shadow-lg z-50" ref={menuRef}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-skribble-azure/20">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-skribble-azure" />
          <h3 className="font-medium text-skribble-sky">Collaborators</h3>
          <span className="bg-skribble-azure/20 text-skribble-azure px-2 py-1 rounded-full text-xs">
            {collaborators.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-skribble-azure/20 text-skribble-azure transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-skribble-azure" />
            <span className="ml-2 text-skribble-azure">Loading collaborators...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchCollaborators}
              className="mt-2 text-skribble-azure hover:text-skribble-sky text-sm"
            >
              Try again
            </button>
          </div>
        ) : (
          <div>
            {/* Project Creator Section */}
            {projectCreator && <CreatorDisplay creator={projectCreator} />}
            
            {/* Collaborators Section */}
            {collaborators.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-skribble-azure/40 mx-auto mb-3" />
                <p className="text-skribble-azure/70">No collaborators yet</p>
                <p className="text-skribble-azure/50 text-sm mt-1">
                  Share your project to start collaborating
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {/* Optional section header for collaborators */}
                <div className="px-3 py-2 text-xs font-medium text-skribble-azure/60 uppercase tracking-wider">
                  Collaborators ({collaborators.length})
                </div>
                
                {collaborators.map((collaborator) => {
              const role = getRoleDisplay(collaborator.role);
              const status = getStatusDisplay(collaborator.status);
              const isCurrentUser = collaborator.userId === currentUserId;
              const isRemoving = removingIds.has(collaborator.id);
              const canRemove = isProjectCreator && !isCurrentUser;

              return ( 
                <div key={collaborator.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-skribble-azure/10 transition-colors">
                  {/* Profile Image */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-skribble-azure/20 flex-shrink-0">
                    {collaborator.user.profileImage ? (
                      <Image 
                        src={collaborator.user.profileImage} 
                        alt={collaborator.user.username}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-skribble-azure to-skribble-purple">
                        <span className="text-white font-medium text-sm">
                          {collaborator.user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-skribble-sky truncate">
                        {collaborator.user.username}
                        {isCurrentUser && (
                          <span className="text-skribble-azure/70 text-xs ml-1">(You)</span>
                        )}
                      </p>
                      {collaborator.role === 'admin' && (
                        <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${role.color}`}>{role.label}</span>
                      <span className="text-skribble-azure/40">•</span>
                      <span className={`text-xs ${status.color}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-skribble-azure/60 truncate mt-1">
                      {collaborator.user.email}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canRemove && (
                      <button
                        onClick={() => handleRemoveCollaborator(collaborator)}
                        disabled={isRemoving}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        title={`Remove ${collaborator.user.username}`}
                      >
                        {isRemoving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserMinus className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => window.open(`mailto:${collaborator.user.email}`, '_blank')}
                      className="p-1.5 rounded-lg hover:bg-skribble-azure/20 text-skribble-azure hover:text-skribble-sky transition-colors"
                      title={`Email ${collaborator.user.username}`}
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      </div>
      {/* Footer */}
      {!isLoading && !error && (
        <div className="p-3 border-t border-skribble-azure/20 text-center">
          <p className="text-xs text-skribble-azure/60">
            {isProjectCreator ? 'You can remove collaborators by clicking the remove button' : 'Only project creators can manage collaborators'}
          </p>
        </div>
      )}
    </div>
  );
}
