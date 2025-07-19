// frontend/src/app/project/[id]/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  Share2, 
  Download, 
  MoreVertical,
  Clock,
  MessageCircle,
  Loader2
} from 'lucide-react';
import IntegratedWaveformPlayer from '@/components/IntegratedWaveformPlayer';
import CollaboratorsMenu from '@/components/CollaboratorsMenu';
import CollaboratorsMenuPortal from '@/components/Portal';
import Image from 'next/image';
import ProjectMenu from '@/components/ProjectMenu';
import ProjectMenuPortal from '@/components/ProjectMenuPortal';


interface User {
  id: string;
  email: string;
  username: string;
  role: 'producer' | 'artist' | 'both';
  subscriptionTier: string;
  profileImage?: string | null;
}

interface ProjectData {
  id: string;
  title: string;
  creatorId: string;
  showMenu?: boolean;
  creator: {
    username: string;
    email: string;
  };
  status: 'active' | 'completed' | 'archived';
  deadline?: string;
  shareLink: string;
  settings: {
    allowDownload: boolean;
    watermarkPreviews: boolean;
    autoExpire: boolean;
    maxCollaborators: number;
    requireApproval: boolean;
  };
  collaborators: any[];
  audioFiles: {
    id: string;
    projectId: string;
    version: string;
    filename: string;
    originalFilename: string;
    fileUrl: string;
    duration: number;
    sampleRate: number;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    isActive: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  title: string;
  creatorId?: string;
  creator?: {
    username: string;
  };
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  shareLink?: string;
  deadline?: string; // ✨ NEW: Deadline field
  // Legacy fields for backward compatibility
  annotations?: number;
  lastUpdated?: string;
  duration?: string;
  showMenu?: boolean;
}

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAudioFile, setCurrentAudioFile] = useState<any>(null);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);
  const [audioUrlLoading, setAudioUrlLoading] = useState(true);
  const [isSwitchingVersion, setIsSwitchingVersion] = useState<string | null>(null);


  useEffect(() => {
    initializePage();
  }, [projectId]);


  const fetchSignedAudioUrl = async (audioFileId: string) => {
    try {
      setAudioUrlLoading(true);
      setError(null);
      
      const token = localStorage.getItem('skribble_token');
      if (!token) {
        console.error('❌ ProjectPage: No auth token found');
        throw new Error('No auth token');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/download/${audioFileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ProjectPage: Response not OK:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data?.downloadUrl) {
        const signedUrl = data.data.downloadUrl;
        
        // Validate the URL format
        try {
          const url = new URL(signedUrl);
          if (!url.hostname.includes('s3') || !url.search.includes('X-Amz-')) {
            throw new Error('Invalid S3 signed URL format');
          }
        } catch (urlError) {
          console.error('❌ ProjectPage: Invalid URL format:', urlError);
          throw new Error('Received invalid download URL');
        }    
        setSignedAudioUrl(signedUrl);
        
      } else {
        console.error('❌ ProjectPage: Invalid response structure:', data);
        throw new Error(data.error?.message || 'Failed to get signed URL');
      }
    } catch (error) {
      console.error('❌ ProjectPage: Signed URL error:', error);
      setError('Failed to load audio file');
    } finally {
      setAudioUrlLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 ProjectPage: currentAudioFile changed:', {
      id: currentAudioFile?.id,
      filename: currentAudioFile?.filename,
      version: currentAudioFile?.version
    });
    
    if (currentAudioFile?.id) {
      console.log('🚀 ProjectPage: Triggering signed URL fetch for:', currentAudioFile.id);
      fetchSignedAudioUrl(currentAudioFile.id);
    } else {
      console.log('⚠️ ProjectPage: No currentAudioFile.id, skipping signed URL fetch');
    }
  }, [currentAudioFile?.id]);
  
  const initializePage = async () => {
    const token = localStorage.getItem('skribble_token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Fetch user data
      const userResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const userData = await userResponse.json();
      if (userData.success) {
        setUser(userData.data);
      }

      // Fetch project data
      const projectResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!projectResponse.ok) {
        if (projectResponse.status === 404) {
          setError('Project not found');
          return;
        } else if (projectResponse.status === 403) {
          setError('You do not have permission to view this project');
          return;
        }
        throw new Error('Failed to fetch project data');
      }

      const projectData = await projectResponse.json();
        if (projectData.success) {         
          setProject(projectData.data);
        
        // Set the active audio file
        const activeAudioFile = projectData.data.audioFiles.find((file: any) => file.isActive);
          if (activeAudioFile) {
            setCurrentAudioFile(activeAudioFile);
          } else if (projectData.data.audioFiles.length > 0) {
            // If no active file, use the most recent one
            const sortedFiles = projectData.data.audioFiles.sort(
              (a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
            );
            setCurrentAudioFile(sortedFiles[0]);
          } 
        }   
    } catch (error) {
      console.error('Error initializing project page:', error);
      setError('Failed to load project data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVersionSwitch = async (audioFile: any) => {
  setIsSwitchingVersion(audioFile.id);
  
  try {
    const token = localStorage.getItem('skribble_token');
    if (!token) throw new Error('No authentication token found');
    
    // Call the backend to activate this version
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/versions/${audioFile.id}/activate`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
        
    if (!response.ok) {
      throw new Error(`Failed to switch version: ${response.status}`);
    }
    
    const data = await response.json();    
    if (data.success) {      
      // Update the current audio file
      setCurrentAudioFile(audioFile);
      setSignedAudioUrl(null); // Clear old signed URL
      setAudioUrlLoading(true); // Show loading state
      
      // Refresh project data to update isActive flags
      await initializePage();
      
    } else {
      throw new Error(data.error?.message || 'Failed to switch version');
    }
  } catch (error) {
    alert(`Failed to switch version: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsSwitchingVersion(null);
  }
};

  const handleSetDeadline = async (project: Project): Promise<void> => {
  const deadlineInput = prompt(
    'Set project deadline (YYYY-MM-DD HH:MM or YYYY-MM-DD):',
    project.deadline ? new Date(project.deadline).toISOString().slice(0, 16) : ''
  );
  
  if (!deadlineInput) return;
  
  try {
    const deadline = new Date(deadlineInput);
    if (isNaN(deadline.getTime())) {
      alert('Invalid date format. Please use YYYY-MM-DD HH:MM or YYYY-MM-DD');
      return;
    }
    
    if (deadline <= new Date()) {
      alert('Deadline must be in the future');
      return;
    }
    
    const token = localStorage.getItem('skribble_token');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deadline: deadline.toISOString()
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Update project in state
        setProjects(prev => 
          prev.map(p => 
            p.id === project.id 
              ? { ...p, deadline: deadline.toISOString() }
              : p
          )
        );
        alert('Deadline set successfully!');
      } else {
        alert('Failed to set deadline');
      }
    } else {
      alert('Failed to set deadline');
    }
  } catch (error) {
    console.error('Error setting deadline:', error);
    alert('Failed to set deadline');
  }
};



const handleVersionChange = async (versionData: any) => {
  console.log('🔄 ProjectPage: Version change triggered:', versionData);
  
  // Convert the version data structure to match your audioFile structure
  const audioFile = {
    id: versionData.id,
    projectId: versionData.project_id || projectId,
    version: versionData.version,
    filename: versionData.filename,
    originalFilename: versionData.original_filename || versionData.originalFilename,
    fileUrl: versionData.file_url || versionData.fileUrl,
    duration: versionData.duration || 0,
    sampleRate: versionData.sample_rate || versionData.sampleRate || 44100,
    fileSize: versionData.file_size || versionData.fileSize,
    mimeType: versionData.mime_type || versionData.mimeType,
    uploadedAt: versionData.uploaded_at || versionData.uploadedAt,
    isActive: versionData.is_current_version || versionData.isActive || false
  };
  
  setCurrentAudioFile(audioFile);
  setSignedAudioUrl(null); // Clear old signed URL
  setAudioUrlLoading(true); // Show loading
  
  // 🔑 NEW: Refresh project data to update the "All Versions" section
  try {
    await initializePage();
  } catch (error) {
    console.error('Failed to refresh project data after version change:', error);
  }
};
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const copyShareLink = async () => {
    if (project) {
      const shareUrl = `${window.location.origin}/share/${project.shareLink}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        // Show success toast (you could add a toast library)
        alert('Share link copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy share link:', error);
        // Fallback: prompt user to copy manually
        prompt('Copy this share link:', shareUrl);
      }
    }
  };
  
  const generateViewerLink = async () => {
    try {
      if (!project) return;
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
    }
  } catch (error) {
    console.error('Error generating viewer link:', error);
    alert(`Failed to generate viewer link: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

useEffect(() => {
  if (project && project.audioFiles && project.audioFiles.length > 0) {
    console.log('🎵 ProjectPage: Project loaded with audio files:', {
      projectId: project.id,
      audioFilesCount: project.audioFiles.length,
      activeFile: project.audioFiles.find(af => af.isActive)?.filename || 'none',
      firstFile: project.audioFiles[0]?.filename
    });
  }
}, [project]);

const handleDelete = async (project: Project): Promise<void> => {
    if (!confirm(`Are you sure you want to delete "${project.title}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== project.id));
      } else {
        alert('Failed to delete project');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete project');
    }
  };
  
  const handleMenuToggle = (projectId: string) => {
   setProjects(prev => 
     prev.map(p => ({
       ...p,
       showMenu: p.id === projectId ? !p.showMenu : false
     }))
   );
  };
  const handleMenuClose = (projectId: string) => {
    setProjects(prev => 
      prev.map(p => 
        p.id === projectId ? { ...p, showMenu: false } : p
      )
    );
  };



  const handleInvite = async (project: Project): Promise<void> => {
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
        // Copy link to clipboard
        await navigator.clipboard.writeText(data.data.inviteLink);
        alert('Invite link copied to clipboard! Send this link to the person you want to invite.');
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Failed to generate invite link. Please try again.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-skribble-azure mx-auto mb-4" />
          <p className="text-skribble-azure">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-2 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!project || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Project data not available</p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-2 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="border-b border-skribble-azure/20 bg-skribble-dark/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Back Button and Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div>
                <h1 className="font-madimi text-2xl text-skribble-sky">{project.title}</h1>
                <p className="text-sm text-skribble-azure">
                  by {project.creator.username} • {project.status} • 
                  {project.audioFiles.length} version{project.audioFiles.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={generateViewerLink}
                className="w-full flex items-center gap-3 px-3 py-2 text-skribble-sky hover:bg-skribble-azure/20 rounded-lg transition-colors text-sm"
              >
                <Share2 className="w-4 h-4" />
                Share View-only Link
              </button>

              
              {project.settings.allowDownload && currentAudioFile && (
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL}${currentAudioFile.fileUrl}`}
                  download={currentAudioFile.originalFilename}
                  className="flex items-center gap-2 px-3 py-2 text-skribble-azure hover:text-skribble-sky transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
              {/* Collaborators Button */}
                    <div className="relative">
                    <button
                      onClick={() => setShowCollaborators(!showCollaborators)}
                      className="flex items-center gap-2 left-5 px-3 py-2 bg-skribble-azure/20 hover:bg-skribble-azure/30 text-skribble-azure rounded-lg transition-colors"
                    >
                      <Users className="w-5 h-5" />
                      <span className="text-sm">
                      {project?.collaborators?.length || 0}
                      </span>
                    </button>
                    {/* Collaborators Menu */}
                    <CollaboratorsMenuPortal>
                      <div className="absolute right-4 top-2 mt-2 z-[9999]">
                        <CollaboratorsMenu
                          projectId={projectId}
                          currentUserId={user?.id || ''}
                          isProjectCreator={project?.creatorId === user?.id}
                          isOpen={showCollaborators}
                          onClose={() => setShowCollaborators(false)}
                          onRemoveCollaborator={(collaboratorId) => {
                            setProject(prev => prev ? {
                              ...prev,
                              collaborators: prev.collaborators.filter(c => c.id !== collaboratorId)
                            } : null);
                          }}
                        />
                      </div>
                    </CollaboratorsMenuPortal>
                    </div>
                        <div className="relative">
                          <button
                          className="p-1 text-skribble-purple hover:text-skribble-azure transition-colors"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectMenuOpen(true);
                            setSelectedProject(project.id);
                          }}
                          >
                          <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          {/* Project Menu with Portal */}
                          <ProjectMenuPortal isOpen={projectMenuOpen}>
                          {projectMenuOpen && selectedProject === project.id && (
                            <div 
                            className="fixed inset-0 z-99"
                            onClick={() => {
                              setProjectMenuOpen(false);
                              setSelectedProject(null);
                            }}
                            >
                            <div 
                              onClick={e => e.stopPropagation()} 
                              className="absolute right-12 mt-2 z-[99999]"
                            >
                              <ProjectMenu
                              project={project}
                              isOpen={true}
                              onClose={() => {
                                setProjectMenuOpen(false);
                                setSelectedProject(null);
                              }}
                              onDelete={handleDelete}
                              onInvite={handleInvite}
                              onShare={generateViewerLink}
                              onSetDeadline={handleSetDeadline}
                              />
                            </div>
                            </div>
                          )}
                          </ProjectMenuPortal>
                        </div>
                      </div>
                    </div>
                  </div>
                </header>

        {/* Main Content */}
        <main className="w-full mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row gap-8 w-full max-w-none">
            {/* Main Player Area */}
            <div className="flex-1 min-w-0">
              {currentAudioFile ? (
                <div className="relative">
                  {/* Show loading state while fetching signed URL */}
                  {audioUrlLoading || !signedAudioUrl ? (
  <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-12 border border-skribble-azure/20 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin text-skribble-azure mx-auto mb-4" />
      <p className="text-skribble-azure text-lg mb-2">Loading audio...</p>
      <p className="text-skribble-purple text-sm">
        {audioUrlLoading ? 'Fetching signed URL...' : 'Preparing audio player...'}
              </p>
            </div>
          </div>
        ) : (
          // ✅ FIXED: Added all critical props for annotations and voice notes
          <IntegratedWaveformPlayer
            key={`audio-${currentAudioFile.id}-${currentAudioFile.version}`}
            audioUrl={signedAudioUrl}
            audioFileId={currentAudioFile.id}
            projectId={project.id}
            title={`${project.title} - ${currentAudioFile.version}`}
            currentUser={{
              id: user.id,
              username: user.username,
              email: user.email
            }}
            isViewOnly={false}  // ✅ Enable annotations
            disableAnnotationFetching={false}  // ✅ Enable annotation fetching
            initialAnnotations={[]}  // ✅ Start with empty array
            onVersionChange={handleVersionChange}
            onTimeUpdate={(currentTime) => {
              // Optional: Track playback time
              console.log('Current time:', currentTime);
            }}
            onLoadComplete={(duration) => {
              console.log('🎵 ProjectPage: Audio loaded successfully, duration:', duration);
              setAudioUrlLoading(false);
            }}
          />
        )}
                </div>
              ) : (
                <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-12 border border-skribble-azure/20 text-center">
                  <p className="text-skribble-azure text-lg mb-4">No audio files found</p>
                  <p className="text-skribble-purple text-sm">Upload an audio file to get started with annotations</p>
                </div>
              )}
          </div>
          {/* Sidebar */}
            <div className="flex flex-col gap-8 w-full lg:w-96 z-[1]">

            {/* Project Info */}
            <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 flex flex-col items-center">
              <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 w-full">
                <h3 className="font-madimi text-lg text-skribble-sky mb-4">Project Info</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-skribble-azure">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      project.status === 'active' 
                        ? 'bg-green-500/20 text-green-200' 
                        : 'bg-skribble-azure/20 text-skribble-azure'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-skribble-azure">Collaborators:</span>
                    <div className="flex -space-x-2">
                      {project.collaborators.map((collaborator: { id: string; username: string },) => (
                        <Image
                          key={collaborator.id}
                          className="rounded-full object-cover border-2 border-skribble-dark hover:border-skribble-azure transition-colors"
                          src={`/users/${collaborator.id}/profileImage`}
                          alt={collaborator.username}
                          title={collaborator.username}
                          width={28} // Set the width of the image
                          height={28} // Set the height of the image
                        />
                      ))}
                      {project.collaborators.length > 3 && (
                      <div className="w-7 h-7 rounded-full bg-skribble-plum text-skribble-azure border-2 border-skribble-dark flex items-center justify-center">
                        +{project.collaborators.length - 3}
                      </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-skribble-azure">Created:</span>
                    <span className="text-skribble-sky">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-skribble-azure">Updated:</span>
                    <span className="text-skribble-sky">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {project.deadline && (
                    <div className="flex items-center justify-between">
                      <span className="text-skribble-azure">Deadline:</span>
                      <span className="text-yellow-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(project.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Current Audio File Info */}
            {currentAudioFile && (
              <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 w-full">
                <h3 className="font-madimi text-lg text-skribble-sky mb-4">Current Version</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-skribble-azure block">Version:</span>
                    <span className="text-skribble-sky font-mono">{currentAudioFile.version}</span>
                  </div>
                  <div>
                    <span className="text-skribble-azure block">Filename:</span>
                    <span className="text-skribble-sky text-xs break-all">
                      {currentAudioFile.originalFilename}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-skribble-azure">Duration:</span>
                    <span className="text-skribble-sky font-mono">
                      {formatDuration(currentAudioFile.duration)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-skribble-azure">Size:</span>
                    <span className="text-skribble-sky">{formatFileSize(currentAudioFile.fileSize)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-skribble-azure">Sample Rate:</span>
                    <span className="text-skribble-sky">{currentAudioFile.sampleRate} Hz</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-skribble-azure">Uploaded:</span>
                    <span className="text-skribble-sky">
                      {new Date(currentAudioFile.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* All Versions */}
              {project.audioFiles.length > 1 && (
                <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 w-full">
                  <h3 className="font-madimi text-lg text-skribble-sky mb-4">
                    All Versions ({project.audioFiles.length})
                  </h3>
                  <div className="space-y-2">
                    {project.audioFiles
                        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
                        .map((file, index) => (
                        <div
                          key={file.id}
                          className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                            currentAudioFile?.id === file.id
                              ? 'border-skribble-azure bg-skribble-azure/10 shadow-lg'
                              : 'border-skribble-azure/20 hover:border-skribble-azure/40'
                          } ${isSwitchingVersion === file.id ? 'opacity-50 pointer-events-none' : ''}`}
                          onClick={() => {
                            // 🔑 FIXED: Use the proper version switching function
                            if (currentAudioFile?.id !== file.id && isSwitchingVersion !== file.id) {
                              handleVersionSwitch(file);
                            }
                          }}
                        >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-skribble-sky font-mono text-sm font-semibold">
                              {file.version}
                            </span>
                            {file.isActive && (
                              <span className="bg-green-500/20 text-green-200 px-2 py-0.5 rounded-full text-xs">
                                Active
                              </span>
                            )}
                            {currentAudioFile?.id === file.id && (
                              <span className="bg-skribble-azure/20 text-skribble-azure px-2 py-0.5 rounded-full text-xs">
                                Current
                              </span>
                            )}
                            {index === 0 && !file.isActive && (
                              <span className="bg-skribble-purple/20 text-skribble-purple px-2 py-0.5 rounded-full text-xs">
                                Latest
                              </span>
                            )}
                          </div>
                          
                          <div className="text-xs text-skribble-azure flex items-center gap-2">
                            {isSwitchingVersion === file.id ? (
                              <>
                                <div className="w-3 h-3 border border-skribble-azure border-t-transparent rounded-full animate-spin" />
                                <span>Switching...</span>
                              </>
                            ) : currentAudioFile?.id === file.id ? (
                              <span className="text-green-400">✓ Loaded</span>
                            ) : (
                              <span>Click to load</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-xs text-skribble-azure">
                          {formatFileSize(file.fileSize)} • {new Date(file.uploadedAt).toLocaleDateString()}
                        </div>
                        
                        <div className="text-xs text-skribble-purple/70 mt-1">
                          {file.originalFilename || file.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 text-xs text-skribble-azure/70 text-center">
                    💡 Click any version above to switch
                  </div>
                </div>
              )}
            </div>
          </div> 
      </main>
    </div>
  );
}