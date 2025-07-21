// frontend/src/app/docs/page.tsx - Fixed TypeScript Types
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Book, 
  Play, 
  Users, 
  Settings, 
  Code, 
  Shield, 
  Bug, 
  Zap,
  MessageCircle,
  Download,
  Clock,
  Music,
  ChevronRight,
  ChevronDown,
  Search,
  ExternalLink,
  Copy,
  Check,
  ArrowUp
} from 'lucide-react';

// Type definitions
interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
}

interface CodeBlockProps {
  code: string;
  id: string;
  title: string;
}

const DocsPage = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string>('');
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);

  // Handle scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Copy code functionality with proper typing
  const copyCode = (code: string, id: string): void => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Scroll to top
  const scrollToTop = (): void => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigation sections
  const navSections: NavSection[] = [
    { id: 'overview', label: 'Overview', icon: Book },
    { id: 'quickstart', label: 'Quick Start', icon: Play },
    { id: 'features', label: 'Core Features', icon: Settings },
    { id: 'advanced', label: 'Advanced Features', icon: Zap },
    { id: 'api', label: 'API Reference', icon: Code },
    { id: 'specs', label: 'Specifications', icon: Music },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: Bug },
    { id: 'integrations', label: 'Integrations', icon: ExternalLink },
  ];

  // Code blocks data with proper typing
  const codeBlocks: Record<string, string> = {
    auth: `// Login and get access token
POST /api/auth/login
Content-Type: application/json

{
  "email": "producer@example.com",
  "password": "your_password"
}`,
    project: `// Create new project
POST /api/projects
Authorization: Bearer <your_token>
Content-Type: multipart/form-data

{
  "title": "My New Beat",
  "deadline": "2024-12-31T23:59:59Z",
  "audioFile": <file>
}`,
    annotation: `// Add annotation to project
POST /api/annotations
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "audioFileId": "uuid",
  "timestamp": 45.5,
  "text": "Love this melody!",
  "annotationType": "comment",
  "priority": "medium"
}`,
    websocket: `// Connect to real-time events
const socket = io('wss://api.skribble.com');

socket.emit('join-project', projectId);

socket.on('annotation-created', (annotation) => {
  console.log('New annotation:', annotation);
});`
  };

  // CodeBlock component with proper typing
  const CodeBlock: React.FC<CodeBlockProps> = ({ code, id, title }) => (
    <div className="bg-skribble-dark/50 border border-skribble-azure/20 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-skribble-azure/10 border-b border-skribble-azure/20">
        <span className="text-sm font-medium text-skribble-sky">{title}</span>
        <button
          onClick={() => copyCode(code, id)}
          className="flex items-center gap-2 text-sm text-skribble-azure hover:text-skribble-sky transition-colors"
        >
          {copiedCode === id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copiedCode === id ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-skribble-azure">{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="relative z-50 px-6 py-6 border-b border-skribble-azure/20">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-skribble-sky hover:text-skribble-azure transition-colors">
            <div className="relative">
              <h1 className="font-madimi text-2xl">Skribble</h1>
              <div className="absolute -top-2 -right-3 bg-skribble-azure rounded-lg rounded-bl-sm px-1.5 py-0.5">
                <div className="flex items-center gap-0.5">
                  <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                  <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                  <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </Link>
          
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-skribble-azure hover:text-skribble-sky transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="text-skribble-azure hover:text-skribble-sky transition-colors">
              Contact
            </Link>
            <Link 
              href="/login" 
              className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300"
            >
              Sign In
            </Link>
          </div>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar Navigation */}
        <div className="w-64 shrink-0">
          <div className="sticky top-8">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-skribble-azure/60" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-skribble-dark/50 border border-skribble-azure/20 rounded-lg text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none"
                />
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-2">
              {navSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-skribble-azure/20 text-skribble-sky border border-skribble-azure/30'
                        : 'text-skribble-azure hover:text-skribble-sky hover:bg-skribble-plum/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
            
            {/* Overview Section */}
            {activeSection === 'overview' && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl font-madimi text-skribble-sky mb-4">📚 Documentation</h1>
                  <p className="text-lg text-skribble-azure mb-8">
                    Everything you need to know about using Skribble for music collaboration.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-skribble-dark/30 rounded-lg p-6">
                    <h3 className="text-xl font-madimi text-skribble-sky mb-3">🚀 Quick Start</h3>
                    <p className="text-skribble-azure mb-4">
                      Get up and running with Skribble in under 5 minutes.
                    </p>
                    <button
                      onClick={() => setActiveSection('quickstart')}
                      className="text-skribble-azure hover:text-skribble-sky transition-colors"
                    >
                      Read Guide →
                    </button>
                  </div>

                  <div className="bg-skribble-dark/30 rounded-lg p-6">
                    <h3 className="text-xl font-madimi text-skribble-sky mb-3">🛠️ API Reference</h3>
                    <p className="text-skribble-azure mb-4">
                      Complete API documentation for developers.
                    </p>
                    <button
                      onClick={() => setActiveSection('api')}
                      className="text-skribble-azure hover:text-skribble-sky transition-colors"
                    >
                      Explore API →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Start Section */}
            {activeSection === 'quickstart' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-madimi text-skribble-sky mb-6">🚀 Quick Start Guide</h2>
                  
                  <div className="space-y-6">
                    <div className="bg-skribble-azure/10 border border-skribble-azure/30 rounded-lg p-6">
                      <h3 className="text-lg font-madimi text-skribble-sky mb-3">Step 1: Create Account</h3>
                      <p className="text-skribble-azure mb-4">
                        Sign up for a Skribble account and choose your subscription tier.
                      </p>
                      <div className="bg-skribble-dark/50 rounded-lg p-4">
                        <code className="text-skribble-azure">
                          1. Visit skribble.com/register<br/>
                          2. Choose your plan (Indie, Producer, or Studio)<br/>
                          3. Complete registration
                        </code>
                      </div>
                    </div>

                    <div className="bg-skribble-azure/10 border border-skribble-azure/30 rounded-lg p-6">
                      <h3 className="text-lg font-madimi text-skribble-sky mb-3">Step 2: Upload Audio</h3>
                      <p className="text-skribble-azure mb-4">
                        Upload your first audio file to start collaborating.
                      </p>
                      <div className="bg-skribble-dark/50 rounded-lg p-4">
                        <code className="text-skribble-azure">
                          1. Click "New Project" in dashboard<br/>
                          2. Drag & drop your audio file<br/>
                          3. Add project title and settings
                        </code>
                      </div>
                    </div>

                    <div className="bg-skribble-azure/10 border border-skribble-azure/30 rounded-lg p-6">
                      <h3 className="text-lg font-madimi text-skribble-sky mb-3">Step 3: Invite Collaborators</h3>
                      <p className="text-skribble-azure mb-4">
                        Share your project with artists and get feedback.
                      </p>
                      <div className="bg-skribble-dark/50 rounded-lg p-4">
                        <code className="text-skribble-azure">
                          1. Click "Share Project" button<br/>
                          2. Generate invite link<br/>
                          3. Send link to collaborators
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* API Reference Section */}
            {activeSection === 'api' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-madimi text-skribble-sky mb-6">🛠️ API Reference</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-madimi text-skribble-sky mb-4">Authentication</h3>
                      <CodeBlock 
                        code={codeBlocks.auth}
                        id="auth"
                        title="Login Request"
                      />
                    </div>

                    <div>
                      <h3 className="text-xl font-madimi text-skribble-sky mb-4">Projects</h3>
                      <CodeBlock 
                        code={codeBlocks.project}
                        id="project"
                        title="Create Project"
                      />
                    </div>

                    <div>
                      <h3 className="text-xl font-madimi text-skribble-sky mb-4">Annotations</h3>
                      <CodeBlock 
                        code={codeBlocks.annotation}
                        id="annotation"
                        title="Create Annotation"
                      />
                    </div>

                    <div className="bg-skribble-azure/10 border border-skribble-azure/30 rounded-lg p-6">
                      <h3 className="text-lg font-madimi text-skribble-sky mb-3">Real-Time Events</h3>
                      <p className="text-skribble-azure mb-4">
                        Connect to our WebSocket endpoint for real-time collaboration features:
                      </p>
                      <CodeBlock 
                        code={codeBlocks.websocket}
                        id="websocket"
                        title="WebSocket Connection"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Core Features Section */}
            {activeSection === 'features' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-madimi text-skribble-sky mb-6">⚡ Core Features</h2>
                  
                  <div className="grid gap-6">
                    <div className="bg-skribble-dark/30 rounded-lg p-6">
                      <h3 className="text-xl font-madimi text-skribble-sky mb-3">🎵 Audio Waveform Visualization</h3>
                      <p className="text-skribble-azure mb-4">
                        Interactive waveform display with precise timestamp navigation.
                      </p>
                      <ul className="space-y-2 text-skribble-azure">
                        <li>• Visual waveform rendering</li>
                        <li>• Clickable timestamp navigation</li>
                        <li>• Zoom and pan controls</li>
                        <li>• Real-time playback cursor</li>
                      </ul>
                    </div>

                    <div className="bg-skribble-dark/30 rounded-lg p-6">
                      <h3 className="text-xl font-madimi text-skribble-sky mb-3">💬 Timestamp Annotations</h3>
                      <p className="text-skribble-azure mb-4">
                        Add comments, suggestions, and feedback at exact moments in your tracks.
                      </p>
                      <ul className="space-y-2 text-skribble-azure">
                        <li>• Precise timestamp commenting</li>
                        <li>• Voice note attachments</li>
                        <li>• Priority levels and categories</li>
                        <li>• Threaded discussions</li>
                      </ul>
                    </div>

                    <div className="bg-skribble-dark/30 rounded-lg p-6">
                      <h3 className="text-xl font-madimi text-skribble-sky mb-3">🔄 Real-time Collaboration</h3>
                      <p className="text-skribble-azure mb-4">
                        See what collaborators are doing in real-time as they listen and comment.
                      </p>
                      <ul className="space-y-2 text-skribble-azure">
                        <li>• Live playback synchronization</li>
                        <li>• Real-time comment updates</li>
                        <li>• User presence indicators</li>
                        <li>• Instant notifications</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other sections would go here following the same pattern */}
            {activeSection === 'specs' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-madimi text-skribble-sky mb-6">📋 Technical Specifications</h2>
                <div className="bg-skribble-dark/30 rounded-lg p-6">
                  <h3 className="text-xl font-madimi text-skribble-sky mb-4">Supported Audio Formats</h3>
                  <ul className="space-y-2 text-skribble-azure">
                    <li>• MP3 (up to 320kbps)</li>
                    <li>• WAV (uncompressed)</li>
                    <li>• AIFF (uncompressed)</li>
                    <li>• FLAC (lossless)</li>
                    <li>• M4A (AAC)</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Security Section */}
            {activeSection === 'security' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-madimi text-skribble-sky mb-6">🔒 Security & Privacy</h2>
                <div className="bg-skribble-dark/30 rounded-lg p-6">
                  <h3 className="text-xl font-madimi text-skribble-sky mb-4">Data Protection</h3>
                  <ul className="space-y-2 text-skribble-azure">
                    <li>• End-to-end encryption for audio files</li>
                    <li>• Private project sharing links</li>
                    <li>• Secure user authentication</li>
                    <li>• Regular security audits</li>
                  </ul>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-skribble-azure text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default DocsPage;