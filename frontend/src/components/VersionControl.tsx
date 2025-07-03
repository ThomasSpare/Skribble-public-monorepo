// frontend/src/components/VersionControl.tsx - FIXED
import React, { useState, useEffect } from 'react';
import { Upload, History, FileText, Users, Clock, Download, Music, MessageCircle, Plus, X, Play } from 'lucide-react';

interface Version {
  id: string;
  version: string; // 🔑 FIXED: Use 'version' not 'version_number'
  original_filename: string;
  file_url: string;
  s3_key?: string; // 🔑 ADDED: S3 key field
  file_size: number;
  uploaded_by_name: string;
  uploaded_at: string;
  version_notes: string;
  is_current_version: boolean;
  is_active: boolean; // 🔑 ADDED: Active field
  annotation_count: number;
  mime_type: string;
  created_at: string; // 🔑 ADDED: For proper sorting
}

interface VersionControlProps {
  projectId: string;
  currentUser: any;
  onVersionChange: (version: Version) => void;
  onError: (message: string) => void;
}

export default function VersionControl({ 
  projectId, 
  onVersionChange, 
  onError 
}: VersionControlProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [projectId]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('skribble_token')}`
  });

  const fetchVersions = async () => {
    if (!projectId) {
      console.warn('⚠️ No projectId provided to fetchVersions');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/versions`, {
        headers: getAuthHeaders()
      });
            
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch versions:', errorText);
        throw new Error(`Failed to fetch versions: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // 🔑 CRITICAL FIX: Backend returns data.data directly as array
        const versionsArray = Array.isArray(data.data) ? data.data : [];
        setVersions(versionsArray);
      } else {
        throw new Error(data.error?.message || 'Failed to load versions');
      }
    } catch (error) {
      console.error('❌ Error fetching versions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error while fetching versions';
      onError(errorMessage);
      setVersions([]); // 🔑 CRITICAL: Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !projectId) return;
    
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('audioFile', uploadFile);
    formData.append('versionNotes', versionNotes);
    
    try {
      const token = localStorage.getItem('skribble_token');
      if (!token) throw new Error('No authentication token found');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
            
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Upload failed:', errorData);
        throw new Error(`Upload failed: ${response.status} - ${errorData}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        await fetchVersions(); // Refresh the versions list
        setShowUpload(false);
        setUploadFile(null);
        setVersionNotes('');
        
        onVersionChange(data.data.audioFile);
      } else {
        throw new Error(data.error?.message || 'Upload failed - unknown error');
      }
    } catch (error) {
      console.error('❌ Version upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload new version';
      onError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleVersionSwitch = async (audioFileId: string) => {
    setIsSwitching(audioFileId);
    
    try {
      const token = localStorage.getItem('skribble_token');
      if (!token) throw new Error('No authentication token found');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/versions/${audioFileId}/activate`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
            
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ VersionControl: Version switch failed:', errorText);
        throw new Error(`Failed to switch version: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        await fetchVersions(); // Refresh to update active status
        onVersionChange(data.data.audioFile); // Pass the audioFile object
      } else {
        throw new Error(data.error?.message || 'Failed to switch version');
      }
    } catch (error) {
      console.error('❌ VersionControl: Error switching version:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch version';
      onError(errorMessage);
    } finally {
      setIsSwitching(null);
    }
  };


  // 🔑 ADDED: File validation
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = [
      'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/aiff', 'audio/x-aiff', 'audio/flac', 'audio/x-flac',
      'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/webm'
    ];
    
    const allowedExtensions = ['.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg'];
    const hasValidExtension = allowedExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      onError(`Invalid file type: ${file.type}. Please upload an audio file.`);
      e.target.value = '';
      return;
    }
    
    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      onError('File too large. Maximum size is 50MB.');
      e.target.value = '';
      return;
    }
    
    setUploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Create a fake event to reuse validation logic
      const fakeEvent = {
        target: { files: files, value: '' }
      } as any;
      handleFileSelect(fakeEvent);
    }
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('wav')) return '✪';
    if (mimeType.includes('mp3')) return '🎶';
    if (mimeType.includes('flac')) return '✪';
    if (mimeType.includes('aiff')) return '🎹';
    return '💾';
  };

  if (isLoading) {
    return (
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-skribble-azure border-t-transparent"></div>
          <span className="ml-3 text-skribble-azure">Loading version history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 shadow-lg">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-lg flex items-center justify-center">
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-madimi text-lg text-skribble-sky">Version History</h3>
            <p className="text-sm text-skribble-azure">
              {versions.length} version{versions.length !== 1 ? 's' : ''} • {versions.filter(v => v.is_current_version).length} active
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowUpload(!showUpload)}
          className={`group relative overflow-hidden bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-skribble-azure/25 hover:scale-105 ${
            showUpload ? 'scale-95 shadow-inner' : ''
          }`}
        >
          <div className="flex items-center space-x-2">
            {showUpload ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span className="font-medium">
              {showUpload ? 'Cancel' : 'New Version'}
            </span>
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-r from-skribble-purple to-skribble-azure transform translate-x-full group-hover:translate-x-0 transition-transform duration-300 -z-10"></div>
        </button>
      </div>

      {/* Enhanced Upload Section */}
      {showUpload && (
        <div className="mb-6 relative">
          <div className="animate-in slide-in-from-top-2 duration-300">
            <div className="bg-skribble-dark/40 backdrop-blur-sm rounded-xl p-6 border border-skribble-azure/30">
              <div className="space-y-4">
                {/* Enhanced Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                    dragOver 
                      ? 'border-skribble-azure bg-skribble-azure/10 scale-105' 
                      : 'border-skribble-azure/40 hover:border-skribble-azure/60 hover:bg-skribble-azure/5'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="absolute inset-0 opacity-5">
                    <div className="w-full h-full bg-gradient-to-br from-skribble-azure via-transparent to-skribble-purple rounded-xl"></div>
                  </div>
                  
                  {uploadFile ? (
                    <div className="space-y-3 relative z-10">
                      <div className="w-16 h-16 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Music className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <p className="font-madimi text-skribble-sky text-lg">{uploadFile.name}</p>
                        <p className="text-skribble-azure">{formatFileSize(uploadFile.size)}</p>
                        <p className="text-xs text-skribble-purple mt-1">{uploadFile.type}</p>
                      </div>
                      <button
                        onClick={() => setUploadFile(null)}
                        className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 relative z-10">
                      <div className="w-16 h-16 bg-skribble-azure/20 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="w-8 h-8 text-skribble-azure" />
                      </div>
                      <div>
                        <p className="text-skribble-sky font-medium text-lg">
                          Drop your audio file here
                        </p>
                        <p className="text-skribble-azure">
                          or{' '}
                          <label className="text-skribble-purple hover:text-skribble-sky cursor-pointer font-medium underline decoration-skribble-purple/50 hover:decoration-skribble-sky transition-colors">
                            browse files
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                          </label>
                        </p>
                      </div>
                      <div className="text-xs text-skribble-azure/70">
                        <p>🎵 Supports MP3, WAV, AIFF, FLAC, M4A</p>
                        <p>📁 Maximum file size: 50MB</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Enhanced Notes Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-skribble-sky">
                    Version Notes
                    <span className="text-skribble-azure/70 font-normal"> (optional)</span>
                  </label>
                  <textarea
                    value={versionNotes}
                    onChange={(e) => setVersionNotes(e.target.value)}
                    placeholder="What changed in this version? (e.g., 'Fixed drum timing', 'Added guitar solo', 'Updated mix')"
                    className="w-full px-4 py-3 bg-skribble-dark/50 border border-skribble-azure/30 rounded-lg text-skribble-sky placeholder-skribble-azure/50 focus:outline-none focus:ring-2 focus:ring-skribble-azure focus:border-transparent transition-all"
                    rows={3}
                  />
                </div>
                
                {/* Enhanced Action Buttons */}
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={handleUpload}
                    disabled={!uploadFile || isUploading}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-green-500/25 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                  >
                    {isUploading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <Upload className="w-4 h-4" />
                        <span>Upload Version</span>
                      </div>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowUpload(false);
                      setUploadFile(null);
                      setVersionNotes('');
                    }}
                    className="px-6 py-3 bg-skribble-dark/60 text-skribble-azure border border-skribble-azure/30 rounded-lg font-medium transition-all duration-300 hover:bg-skribble-azure/10 hover:border-skribble-azure/60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Version List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-skribble-dark/20 scrollbar-thumb-skribble-azure/40">
        {versions.map((version, index) => (
          <div
            key={version.id}
            className={`group relative p-5 rounded-xl border transition-all duration-300 hover:shadow-lg ${
              version.is_current_version
                ? 'border-skribble-azure bg-gradient-to-r from-skribble-azure/10 to-skribble-purple/10 shadow-md shadow-skribble-azure/10'
                : 'border-skribble-azure/20 bg-skribble-dark/20 hover:border-skribble-azure/40 hover:bg-skribble-azure/5'
            }`}
          >
            {version.is_current_version && (
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full animate-pulse"></div>
            )}
            
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    version.is_current_version 
                      ? 'bg-gradient-to-r from-skribble-azure to-skribble-purple' 
                      : 'bg-skribble-dark/40'
                  }`}>
                    {getFileIcon(version.mime_type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <span className={`text-lg font-bold font-mono ${
                        version.is_current_version ? 'text-skribble-sky' : 'text-skribble-azure'
                      }`}>
                        {version.version} {/* 🔑 FIXED: Use version field */}
                      </span>
                      
                      {version.is_current_version && (
                        <span className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white text-xs px-3 py-1 rounded-full font-medium">
                          ✨ Current
                        </span>
                      )}
                      
                      {index === 0 && !version.is_current_version && (
                        <span className="bg-skribble-purple/20 text-skribble-purple text-xs px-3 py-1 rounded-full font-medium">
                          🆕 Latest
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-skribble-azure font-medium">
                      {version.original_filename}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div className="flex items-center space-x-2 text-skribble-azure">
                    <Users className="w-4 h-4" />
                    <span>{version.uploaded_by_name}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-skribble-azure">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(version.uploaded_at || version.created_at)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-skribble-azure">
                    <FileText className="w-4 h-4" />
                    <span>{formatFileSize(version.file_size)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={version.s3_key ? 'text-green-400' : 'text-red-400'}>
                      {version.s3_key ? '✓ Cloud Ready' : '✗ Missing S3'}
                    </span>
                  </div>
                </div>
                
                {version.version_notes && (
                  <div className="bg-skribble-dark/30 border-l-4 border-skribble-purple rounded-r-lg p-3 mt-3">
                    <p className="text-sm text-skribble-sky italic">
                      {version.version_notes}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Enhanced Action Buttons */}
              <div className="flex items-center space-x-2 ml-4">
                {/* Version Switch Button */}
                {!version.is_current_version && version.s3_key && (
                  <button
                    onClick={() => handleVersionSwitch(version.id)}
                    disabled={isSwitching === version.id}
                    className="w-10 h-10 bg-skribble-purple/20 hover:bg-gradient-to-r hover:from-skribble-purple hover:to-skribble-azure rounded-lg flex items-center justify-center transition-all duration-300 hover:shadow-lg hover:shadow-skribble-purple/25 disabled:opacity-50"
                    title="Activate this version"
                  >
                    {isSwitching === version.id ? (
                      <div className="w-4 h-4 border-2 border-skribble-purple border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 text-skribble-purple group-hover:text-white transition-colors" />
                    )}
                  </button>
                )}
                
                {/* Download Button */}
                <a
                  href={version.file_url}
                  download={version.original_filename}
                  className="group relative w-10 h-10 bg-skribble-azure/20 hover:bg-gradient-to-r hover:from-skribble-azure hover:to-skribble-purple rounded-lg flex items-center justify-center transition-all duration-300 hover:shadow-lg hover:shadow-skribble-azure/25"
                  title={`Download ${version.original_filename}`}
                >
                  <Download className="w-4 h-4 text-skribble-azure group-hover:text-white transition-colors" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Enhanced Empty State */}
      {!isLoading && versions.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-skribble-azure/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <History className="w-10 h-10 text-skribble-azure/50" />
          </div>
          <p className="text-lg font-madimi text-skribble-azure mb-2">No versions yet</p>
          <p className="text-sm text-skribble-azure/70 mb-4">Upload your first audio file to get started</p>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-skribble-azure/25 hover:scale-105"
          >
            Upload Audio File
          </button>
        </div>
      )}
    </div>
  );
}