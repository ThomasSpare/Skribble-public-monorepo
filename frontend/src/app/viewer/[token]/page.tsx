'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import IntegratedWaveformPlayer from '@/components/IntegratedWaveformPlayer';
import { Loader2, Eye, Music2 } from 'lucide-react';

interface ViewerProject {
  id: string;
  title: string;
  currentAudioFile: {
    id: string;
    filename: string;
    version: string;
    fileUrl: string;
    duration?: number;
  };
  annotations: any[];
}

export default function ViewerPage() {
  const params = useParams();
  const token = params?.token as string;
  const [project, setProject] = useState<ViewerProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);
  const [audioUrlLoading, setAudioUrlLoading] = useState(true);

  const fetchSignedAudioUrl = async (audioFileId: string) => {
    try {
      setAudioUrlLoading(true);
      setError(null);
      
      const token = localStorage.getItem('skribble_token');
      if (!token) throw new Error('No auth token');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload-s3/download/${audioFileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success && data.data?.downloadUrl) {
        console.log('✅ Signed URL fetched for:', audioFileId);
        setSignedAudioUrl(data.data.downloadUrl);
      } else {
        throw new Error(data.error?.message || 'Failed to get signed URL');
      }
    } catch (error) {
      console.error('❌ Signed URL error:', error);
      if (!signedAudioUrl) { // Only set error on first load
        setError('Failed to load audio file');
      }
    } finally {
      setAudioUrlLoading(false);
    }
  };

  useEffect(() => {
    async function fetchProject() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/viewer/${token}`);
        if (!response.ok) {
          throw new Error('Invalid or expired view link');
        }
        const data = await response.json();
        if (data.success) {
          setProject(data.data);
          
          // Fetch signed URL for the audio file
          if (data.data.currentAudioFile?.id) {
            await fetchSignedAudioUrl(data.data.currentAudioFile.id);
          }
        }
      } catch (error: any) {
        setError(error.message);
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
          {loading ? 'Loading project...' : 'Loading audio file...'}
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

  // Construct full audio URL
  // const AudioUrl = project.currentAudioFile.fileUrl.startsWith('http') 
  //   ? project.currentAudioFile.fileUrl 
  //   : `${process.env.NEXT_PUBLIC_API_URL}${project.currentAudioFile.fileUrl}`;

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
                <p className="text-sm text-skribble-azure/70">View-only access</p>
              </div>
            </div>
            <div 
              onClick={() => window.open('https://skribble.website', '_blank')}
              className="relative top-6 inline-block mb-8 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <h1 className="font-madimi text-7xl md:text-8xl bg-gradient-to-r from-skribble-sky via-skribble-azure to-skribble-purple bg-clip-text text-transparent">
              Skribble
              </h1>
              <div className="absolute -top-3 -right-12 bg-skribble-azure rounded-2xl rounded-bl-md px-4 py-2 shadow-xl animate-float">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              </div>
              <h1 className='flex items-center justify-between'>Where Music Meets Collaboration</h1>
            </div>
            <div className="text-sm text-skribble-azure/70 italic">
              Shared via Skribble
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <IntegratedWaveformPlayer
          audioUrl={signedAudioUrl || ''}
          audioFileId={project.currentAudioFile.id}
          projectId={project.id}
          title={project.currentAudioFile.filename}
          isViewOnly={true}
          initialAnnotations={project.annotations}
          disableAnnotationFetching={true}
        />
      </main>
    </div>
  );
}