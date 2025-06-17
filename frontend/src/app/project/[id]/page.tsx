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
import CollaboratorsMenuPortal from '@/components/CollaboratorsMenuPortal';
import Image from 'next/image';

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
  
  useEffect(() => {
    initializePage();
  }, [projectId]);
  
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

  
  const handleVersionChange = (versionData: any) => {
  
  // Convert the version data structure to match your audioFile structure
  const audioFile = {
    id: versionData.id,
    projectId: versionData.projectId || projectId,
    version: versionData.version || `v${versionData.version_number}`,
    filename: versionData.filename,
    originalFilename: versionData.originalFilename || versionData.original_filename,
    fileUrl: versionData.file_url || versionData.fileUrl,
    duration: versionData.duration,
    sampleRate: versionData.sampleRate || versionData.sample_rate,
    fileSize: versionData.fileSize || versionData.file_size,
    mimeType: versionData.mimeType || versionData.mime_type,
    uploadedAt: versionData.uploadedAt || versionData.uploaded_at,
    isActive: versionData.isActive || versionData.is_current_version || false
  };
  
  setCurrentAudioFile(audioFile);
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

  useEffect(() => {
  if (project && project.audioFiles && project.audioFiles.length > 0) {
    const currentAudio = project.audioFiles.find(af => af.isActive) || project.audioFiles[0];
    
    // Test if the URL is accessible
    if (currentAudio?.fileUrl) {
      const testUrl1 = `${process.env.NEXT_PUBLIC_API_URL}${currentAudio.fileUrl}`;
      const testUrl2 = `${process.env.NEXT_PUBLIC_API_URL}/api/upload/audio/${currentAudio.filename}`;
      
      
      fetch(testUrl1, { method: 'HEAD' })
        .then(response => {
          console.log('URL 1 response:', response.status, response.statusText);
        })
        .catch(error => {
          console.error('URL 1 failed:', error);
        });
        
      fetch(testUrl2, { method: 'HEAD' })
        .then(response => {
          console.log('URL 2 response:', response.status, response.statusText);
        })
        .catch(error => {
          console.error('URL 2 failed:', error);
        });
    }
  }
}, [project]);

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
                onClick={async () => { 
                  try {
                    const token = localStorage.getItem('skribble_token');
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/collaboration/${project.id}/share`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        type: 'viewer',
                        expiresIn: 30 // days
                      })
                    });

                    if (!response.ok) {
                      throw new Error('Failed to generate share link');
                    }

                    const data = await response.json();
                    if (data.success) {
                      await navigator.clipboard.writeText(`${window.location.origin}/view/${data.data.shareToken}`);
                      alert('Viewer link copied to clipboard!');
                    }
                  } catch (error) {
                    console.error('Error generating share link:', error);
                    alert('Failed to generate share link');
                  }
                }}
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
                        
                        <button className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors">
                          <Settings className="w-5 h-5" />
                        </button>
                        
                        <button className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
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
                <IntegratedWaveformPlayer
                  key={`audio-${currentAudioFile.id}-${currentAudioFile.version}`}
                  audioUrl={`${process.env.NEXT_PUBLIC_API_URL}/upload/audio/${currentAudioFile.filename}`}
                  audioFileId={currentAudioFile.id}
                  projectId={project.id}
                  title={`${project.title} - ${currentAudioFile.version}`}
                  currentUser={user}
                  onVersionChange={handleVersionChange}
                  onLoadComplete={(duration) => {
                    console.log('Audio loaded, duration:', duration);
                  }}
                />
              ) : (
                <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-12 border border-skribble-azure/20 text-center">
                  <p className="text-skribble-azure text-lg mb-4">No audio files found</p>
                  <p className="text-skribble-purple text-sm">Upload an audio file to get started with annotations</p>
                </div>
              )}
          </div>
          {/* Sidebar */}
          <div className="flex flex-col gap-8 w-full lg:w-96">
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
                      }`}
                      onClick={() => {
                        setCurrentAudioFile(file);
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
                              Playing
                            </span>
                          )}
                          {index === 0 && (
                            <span className="bg-skribble-purple/20 text-skribble-purple px-2 py-0.5 rounded-full text-xs">
                              Latest
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-skribble-azure">
                          Click to load
                        </div>
                      </div>
                      
                      <div className="text-xs text-skribble-azure">
                        {formatFileSize(file.fileSize)} • {new Date(file.uploadedAt).toLocaleDateString()}
                      </div>
                      
                      {/* Optional: Add hover effect instructions */}
                      <div className="text-xs text-skribble-purple/70 mt-1">
                        {file.originalFilename || file.filename}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Add helpful text */}
                <div className="mt-4 text-xs text-skribble-azure/70 text-center">
                  💡 Click any version above to switch audio tracks
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}