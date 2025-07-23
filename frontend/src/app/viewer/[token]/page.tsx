'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import IntegratedWaveformPlayer from '@/components/IntegratedWaveformPlayer';
import { Loader2, Eye, Music2, MessageCircle, Users } from 'lucide-react';

interface ViewerProject {
  id: string;
  title: string;
  currentAudioFile: {
    id: string;
    filename: string;
    version: string;
    fileUrl: string;
    duration?: number;
    waveformData?: any;
  };
  annotations: Array<{
    id: string;
    text: string;
    timestamp: number;
    type: string;
    status: string;
    priority?: string;
    parentId?: string;
    voiceNoteUrl?: string;
    createdAt: string;
    updatedAt?: string;
    createdBy: {
      id: string;
      username: string;
      profileImage?: string;
      role: string;
    };
  }>;
  isViewerMode: boolean;
}

export default function ViewerPage() {
  const params = useParams();
  const token = params?.token as string;
  const [project, setProject] = useState<ViewerProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);
  const [audioUrlLoading, setAudioUrlLoading] = useState(true);

  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/viewer/${token}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Invalid or expired view link');
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
          console.log('✅ Viewer project data loaded:', data.data);
          setProject(data.data);
          
          // Audio URL is already included in the response, no need to fetch separately
          if (data.data.currentAudioFile?.fileUrl) {
            setSignedAudioUrl(data.data.currentAudioFile.fileUrl);
            setAudioUrlLoading(false);
          } else {
            setError('Audio file not available');
            setAudioUrlLoading(false);
          }
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error: any) {
        console.error('❌ Viewer fetch error:', error);
        setError(error.message);
        setAudioUrlLoading(false);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchProject();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-skribble-azure mx-auto mb-4" />
          <p className="text-skribble-azure">
            {audioUrlLoading ? 'Loading audio file...' : 'Loading project...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music2 className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Project Not Found</h1>
          <p className="text-skribble-azure mb-4">{error || 'The shared project could not be found or the link has expired.'}</p>
          <p className="text-sm text-skribble-azure/70">Please check the link or contact the project owner for a new share link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="border-b border-skribble-azure/20 bg-skribble-dark/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-skribble-azure/20 rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-skribble-azure" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">{project.title}</h1>
                <div className="flex items-center gap-4 text-sm text-skribble-azure/70">
                  <span>View-only access</span>
                  {project.annotations && (
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      <span>{project.annotations.length} annotation{project.annotations.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Skribble Branding */}
            <div 
              onClick={() => window.open('https://skribble.website', '_blank')}
              className="relative cursor-pointer hover:opacity-90 transition-opacity"
            >
              <h1 className="font-madimi text-4xl md:text-5xl bg-gradient-to-r from-skribble-sky via-skribble-azure to-skribble-purple bg-clip-text text-transparent">
                Skribble
              </h1>
              <div className="absolute -top-2 -right-8 bg-skribble-azure rounded-lg px-2 py-1 shadow-xl animate-float">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
              <p className='text-xs text-center text-skribble-azure/70 mt-1'>Where Music Meets Collaboration</p>
            </div>
            
            <div className="text-sm text-skribble-azure/70 italic">
              Shared via Skribble
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {signedAudioUrl ? (
          <IntegratedWaveformPlayer
            audioUrl={signedAudioUrl}
            audioFileId={project.currentAudioFile.id}
            projectId={project.id}
            title={project.currentAudioFile.filename}
            isViewOnly={true}
            initialAnnotations={project.annotations}
            disableAnnotationFetching={true}
            waveformData={project.currentAudioFile.waveformData}
          />
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-skribble-azure mx-auto mb-4" />
              <p className="text-skribble-azure">Loading audio player...</p>
            </div>
          </div>
        )}

        {/* Annotations Summary */}
        {project.annotations && project.annotations.length > 0 && (
          <div className="mt-8 bg-skribble-dark/50 rounded-lg p-6 border border-skribble-azure/20">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-skribble-azure" />
              Collaboration Notes ({project.annotations.length})
            </h3>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {project.annotations.map((annotation) => (
                <div key={annotation.id} className="flex items-start gap-3 p-3 bg-skribble-dark/30 rounded-lg">
                  {/* User Avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-skribble-azure/20 flex-shrink-0">
                    {annotation.createdBy.profileImage ? (
                      <img
                        src={annotation.createdBy.profileImage}
                        alt={annotation.createdBy.username}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${annotation.createdBy.profileImage ? 'hidden' : ''}`}>
                      <span className="text-xs font-medium text-skribble-azure">
                        {annotation.createdBy.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Annotation Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-skribble-azure">
                        {annotation.createdBy.username}
                      </span>
                      <span className="text-xs text-skribble-azure/50">
                        {Math.floor(annotation.timestamp / 60)}:{(annotation.timestamp % 60).toFixed(0).padStart(2, '0')}
                      </span>
                      {annotation.voiceNoteUrl && (
                        <span className="text-xs bg-skribble-purple/20 text-skribble-purple px-2 py-0.5 rounded">
                          Voice Note
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-skribble-azure/80">{annotation.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}