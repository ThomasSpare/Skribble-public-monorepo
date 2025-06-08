'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Music, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Play,
  FileAudio,
  Bug,
  Zap,
  Wifi
} from 'lucide-react';

interface AudioUploadProps {
  onUploadComplete?: (projectData: any) => void;
  onClose?: () => void;
}

export default function AudioUpload({ onUploadComplete, onClose }: AudioUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [uploadStage, setUploadStage] = useState<string>('idle');

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[AudioUpload] ${message}`);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
      setError(null);
      addDebugInfo(`File selected: ${file.name} (${file.size} bytes, ${file.type})`);
      
      // Validate file more thoroughly
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        setError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 100MB)`);
        addDebugInfo(`File rejected: too large (${file.size} bytes)`);
        return;
      }
      
      // Check if it's actually an audio file
      const audioTypes = ['audio/', 'application/octet-stream'];
      const audioExtensions = ['.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg'];
      const hasAudioType = audioTypes.some(type => file.type.startsWith(type));
      const hasAudioExt = audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!hasAudioType && !hasAudioExt) {
        setError('Invalid file type. Please upload an audio file (MP3, WAV, AIFF, FLAC, M4A, OGG)');
        addDebugInfo(`File rejected: invalid type (${file.type})`);
        setSelectedFile(null);
        return;
      }
      
      addDebugInfo('File validation passed');
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg'],
      'application/octet-stream': ['.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg'] // Fallback for Windows
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
    onDropRejected: (rejectedFiles) => {
      const rejection = rejectedFiles[0];
      if (rejection?.errors[0]?.code === 'file-too-large') {
        setError('File is too large. Maximum size is 100MB.');
        addDebugInfo(`File rejected: too large (${rejection.file.size} bytes)`);
      } else if (rejection?.errors[0]?.code === 'file-invalid-type') {
        setError('Invalid file type. Please upload an audio file.');
        addDebugInfo(`File rejected: invalid type (${rejection.file.type})`);
      } else {
        setError('File rejected: ' + (rejection?.errors[0]?.message || 'Unknown error'));
        addDebugInfo(`File rejected: ${JSON.stringify(rejection?.errors)}`);
      }
    }
  });

  const testConnection = async () => {
    try {
      setUploadStage('testing-connection');
      addDebugInfo('Testing API connection...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for test
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/test`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      addDebugInfo(`API test success: ${JSON.stringify(data)}`);
      setUploadStage('connection-ok');
      return data;
    } catch (error) {
      setUploadStage('connection-failed');
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          addDebugInfo('API test timeout after 10 seconds');
          throw new Error('Connection test timed out - server may be unreachable');
        } else {
          addDebugInfo(`API test failed: ${error.message}`);
          throw error;
        }
      }
      throw new Error('Unknown connection error');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      setError('Please provide a file and title.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    setDebugInfo([]); // Clear previous debug info
    setUploadStage('starting');

    try {
      // Test connection first
      addDebugInfo('Starting upload process...');
      await testConnection();

      setUploadStage('preparing-upload');
      
      // Prepare form data
      const formData = new FormData();
      formData.append('audioFile', selectedFile);
      formData.append('title', title.trim());
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      const token = localStorage.getItem('skribble_token');
      addDebugInfo(`Token available: ${token ? 'YES' : 'NO'}`);
      addDebugInfo(`File details: ${selectedFile.name}, ${selectedFile.size} bytes, ${selectedFile.type}`);
      addDebugInfo(`API URL: ${process.env.NEXT_PUBLIC_API_URL}`);
      addDebugInfo(`Upload endpoint: ${process.env.NEXT_PUBLIC_API_URL}/upload/project`);

      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      setUploadStage('uploading');
      
      // Create AbortController for upload timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        addDebugInfo('Upload aborted due to timeout (60s)');
        setUploadStage('timeout');
      }, 60000); // 60 second timeout

      addDebugInfo('Sending upload request...');
      
      // Track upload progress if possible
      const startTime = Date.now();
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/project`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type - let browser set it with boundary for multipart
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      setUploadStage('processing-response');
      addDebugInfo(`Request completed in ${duration}ms`);
      addDebugInfo(`Response status: ${response.status} ${response.statusText}`);
      addDebugInfo(`Response headers: ${JSON.stringify([...response.headers.entries()])}`);

      if (!response.ok) {
        const errorText = await response.text();
        addDebugInfo(`Error response body: ${errorText}`);
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (parseError) {
          // Use the raw text if JSON parsing fails
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      addDebugInfo(`Response data: ${JSON.stringify(data)}`);

      if (data.success) {
        setUploadStage('success');
        addDebugInfo('Upload successful!');
        setSuccess(true);
        setTimeout(() => {
          onUploadComplete?.(data.data);
        }, 1500);
      } else {
        setUploadStage('failed');
        addDebugInfo(`Upload failed: ${data.error?.message}`);
        setError(data.error?.message || 'Upload failed');
      }
    } catch (error) {
      setUploadStage('error');
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          addDebugInfo('Upload timed out after 60 seconds');
          setError('Upload timed out. This might be due to:' +
            '\n• Large file size' +
            '\n• Slow internet connection' +
            '\n• Server processing issues' +
            '\n• Antivirus software interference (Windows)');
        } else if (error.message.includes('Failed to fetch')) {
          addDebugInfo('Network error - failed to connect to server');
          setError('Network error. Check if:' +
            '\n• Server is running' +
            '\n• No firewall blocking connection' +
            '\n• Correct API URL in environment');
        } else {
          addDebugInfo(`Upload error: ${error.message}`);
          setError(error.message);
        }
      } else {
        addDebugInfo('Unknown error occurred');
        setError('An unknown error occurred');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setError(null);
    setSuccess(false);
    setDebugInfo([]);
    setUploadStage('idle');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStageIcon = () => {
    switch (uploadStage) {
      case 'testing-connection': return <Wifi className="w-4 h-4 animate-pulse" />;
      case 'connection-ok': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'connection-failed': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'preparing-upload': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'uploading': return <Upload className="w-4 h-4 animate-bounce" />;
      case 'processing-response': return <Zap className="w-4 h-4 animate-pulse" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'timeout': 
      case 'failed': 
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return null;
    }
  };

  const getStageText = () => {
    switch (uploadStage) {
      case 'testing-connection': return 'Testing connection...';
      case 'connection-ok': return 'Connection OK';
      case 'connection-failed': return 'Connection failed';
      case 'preparing-upload': return 'Preparing upload...';
      case 'uploading': return 'Uploading file...';
      case 'processing-response': return 'Processing...';
      case 'success': return 'Upload complete!';
      case 'timeout': return 'Upload timed out';
      case 'failed': return 'Upload failed';
      case 'error': return 'Error occurred';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl border border-skribble-azure/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-skribble-azure/20">
          <h2 className="text-2xl font-madimi text-skribble-sky">Upload Audio</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors"
              title="Toggle Debug Info"
            >
              <Bug className="w-4 h-4" />
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 text-skribble-azure hover:text-skribble-sky transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Stage Indicator */}
          {isUploading && (
            <div className="bg-skribble-dark/30 rounded-xl p-4 border border-skribble-azure/20">
              <div className="flex items-center gap-3">
                {getStageIcon()}
                <span className="text-skribble-sky">{getStageText()}</span>
                {uploadStage === 'uploading' && (
                  <div className="flex-1 bg-skribble-dark/50 rounded-full h-2">
                    <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple h-2 rounded-full animate-pulse w-1/2" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debug Panel */}
          {showDebug && (
            <div className="bg-skribble-dark/30 rounded-xl p-4 border border-skribble-azure/20">
              <h3 className="text-sm font-medium text-skribble-azure mb-2">Debug Information</h3>
              <div className="bg-black/20 rounded p-2 max-h-40 overflow-y-auto">
                {debugInfo.length > 0 ? (
                  <pre className="text-xs text-skribble-sky whitespace-pre-wrap">
                    {debugInfo.join('\n')}
                  </pre>
                ) : (
                  <p className="text-xs text-skribble-purple">No debug info yet</p>
                )}
              </div>
              <button
                onClick={() => setDebugInfo([])}
                className="mt-2 text-xs text-skribble-azure hover:text-skribble-sky"
              >
                Clear Debug Log
              </button>
            </div>
          )}

          {/* File Drop Zone */}
          {!selectedFile && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-skribble-azure bg-skribble-azure/10'
                  : 'border-skribble-azure/30 hover:border-skribble-azure/50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-lg text-skribble-sky mb-2">
                    {isDragActive ? 'Drop your audio file here' : 'Drag & drop your audio file'}
                  </p>
                  <p className="text-skribble-azure text-sm">
                    or <span className="text-skribble-sky">click to browse</span>
                  </p>
                  <p className="text-skribble-purple text-xs mt-2">
                    Supports MP3, WAV, AIFF, FLAC, M4A, OGG (max 100MB)
                  </p>
                  <p className="text-skribble-purple text-xs mt-1">
                    If uploads fail on Windows, try running as administrator or check antivirus settings
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selected File Preview */}
          {selectedFile && !success && (
            <div className="bg-skribble-dark/30 rounded-xl p-4 border border-skribble-azure/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileAudio className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-skribble-sky font-medium truncate">{selectedFile.name}</p>
                  <p className="text-skribble-azure text-sm">
                    {formatFileSize(selectedFile.size)} • {selectedFile.type || 'unknown type'}
                  </p>
                  <p className="text-skribble-purple text-xs mt-1">
                    Extension: {selectedFile.name.split('.').pop()?.toUpperCase() || 'none'}
                  </p>
                </div>
                {!isUploading && (
                  <button
                    onClick={removeFile}
                    className="p-1 text-skribble-purple hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Success State */}
          {success && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-madimi text-skribble-sky mb-2">Upload Successful!</h3>
              <p className="text-skribble-azure">Your project has been created and is ready for collaboration.</p>
            </div>
          )}

          {/* Form Fields */}
          {selectedFile && !success && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-skribble-azure mb-2">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-skribble-plum/50 border border-skribble-azure/30 rounded-lg text-skribble-sky placeholder-skribble-purple/70 focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all"
                  placeholder="Enter a title for your project"
                  disabled={isUploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-skribble-azure mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-skribble-plum/50 border border-skribble-azure/30 rounded-lg text-skribble-sky placeholder-skribble-purple/70 focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all resize-none"
                  placeholder="Describe your project..."
                  disabled={isUploading}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
              <div className="text-red-200 text-sm">
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            </div>
          )}

          {/* Actions */}
          {selectedFile && !success && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-skribble-azure/20">
              <button
                onClick={removeFile}
                disabled={isUploading}
                className="px-4 py-2 text-skribble-azure hover:text-skribble-sky transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || !title.trim()}
                className="flex items-center gap-2 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {getStageText() || 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Music className="w-4 h-4" />
                    Create Project
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}