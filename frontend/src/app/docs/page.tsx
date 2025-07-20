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

const DocsPage = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Handle scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Copy code functionality
  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Scroll to top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigation sections
  const navSections = [
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

  // Code blocks data
  const codeBlocks = {
    auth: `// Login and get access token
POST /api/auth/login
Content-Type: application/json

{
  "email": "producer@example.com",
  "password": "your_password"
}`,
    project: `// Create new project
POST /api/projects
Authorization: Bearer <token>

{
  "title": "New Beat Collaboration",
  "settings": {
    "allowDownload": true,
    "watermarkPreviews": false,
    "maxCollaborators": 5
  }
}`,
    annotation: `// Create annotation
POST /api/annotations
Authorization: Bearer <token>

{
  "audioFileId": "uuid",
  "timestamp": 45.5,
  "text": "This drop needs more bass",
  "annotationType": "comment",
  "priority": "high"
}`
  };

  const CodeBlock = ({ code, id, title }) => (
    <div className="bg-skribble-dark/50 border border-skribble-azure/20 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-skribble-plum/20 px-4 py-2 border-b border-skribble-azure/10">
        <span className="text-sm font-medium text-skribble-sky">{title}</span>
        <button
          onClick={() => copyCode(code, id)}
          className="flex items-center gap-2 px-2 py-1 text-xs text-skribble-azure hover:text-skribble-sky transition-colors"
        >
          {copiedCode === id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copiedCode === id ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm text-skribble-azure overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );

  const FeatureCard = ({ icon: Icon, title, description, details }) => (
    <div className="bg-skribble-plum/20 border border-skribble-azure/20 rounded-lg p-6 hover:border-skribble-azure/40 transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-skribble-azure/20 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-skribble-azure" />
        </div>
        <h3 className="text-lg font-madimi text-skribble-sky">{title}</h3>
      </div>
      <p className="text-skribble-azure mb-4">{description}</p>
      <ul className="space-y-2">
        {details.map((detail, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-skribble-azure/80">
            <ChevronRight className="w-3 h-3 text-skribble-purple" />
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-skribble-dark/80 backdrop-blur-md border-b border-skribble-azure/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-madimi text-skribble-sky">Skribble Documentation</h1>
              <p className="text-skribble-azure/80">Complete guide to music collaboration</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-skribble-azure/50" />
              <input
                type="text"
                placeholder="Search docs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-skribble-dark/50 border border-skribble-azure/30 rounded-lg text-skribble-sky placeholder-skribble-azure/50 focus:outline-none focus:ring-2 focus:ring-skribble-azure focus:border-transparent w-64"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <div className="sticky top-24">
            <nav className="space-y-2">
              {navSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-skribble-azure/20 text-skribble-sky border border-skribble-azure/40'
                        : 'text-skribble-azure hover:bg-skribble-azure/10 hover:text-skribble-sky'
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
        <div className="flex-1 max-w-none">
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-madimi text-skribble-sky mb-4">🎵 Welcome to Skribble</h2>
                <p className="text-lg text-skribble-azure mb-6">
                  Skribble transforms how music producers and artists collaborate. This documentation will help you master every feature and get the most out of your creative partnerships.
                </p>
                <div className="bg-skribble-purple/20 border border-skribble-purple/40 rounded-lg p-4 mb-6">
                  <p className="text-skribble-sky italic">
                    "Simplicity is the ultimate sophistication." - Leonardo da Vinci
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-skribble-azure/10 border border-skribble-azure/30 rounded-lg p-4">
                    <h3 className="font-madimi text-skribble-sky mb-2">New to Skribble?</h3>
                    <p className="text-skribble-azure text-sm mb-3">Start with our Quick Start Guide</p>
                    <button
                      onClick={() => setActiveSection('quickstart')}
                      className="text-skribble-azure hover:text-skribble-sky transition-colors text-sm flex items-center gap-1"
                    >
                      Get Started <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="bg-skribble-purple/10 border border-skribble-purple/30 rounded-lg p-4">
                    <h3 className="font-madimi text-skribble-sky mb-2">Need Help?</h3>
                    <p className="text-skribble-azure text-sm mb-3">Check troubleshooting or contact support</p>
                    <button
                      onClick={() => setActiveSection('troubleshooting')}
                      className="text-skribble-azure hover:text-skribble-sky transition-colors text-sm flex items-center gap-1"
                    >
                      Get Help <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'quickstart' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-madimi text-skribble-sky mb-6">🚀 Quick Start Guide</h2>
                
                <div className="grid lg:grid-cols-2 gap-8">
                  {/* For Producers */}
                  <div className="bg-skribble-plum/20 border border-skribble-azure/20 rounded-lg p-6">
                    <h3 className="text-xl font-madimi text-skribble-sky mb-4 flex items-center gap-2">
                      <Music className="w-5 h-5" />
                      For Producers
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="border-l-4 border-skribble-azure pl-4">
                        <h4 className="font-semibold text-skribble-sky mb-2">1. Create Your Account</h4>
                        <p className="text-sm text-skribble-azure mb-2">Choose the subscription tier that fits your needs:</p>
                        <ul className="text-sm text-skribble-azure/80 space-y-1">
                          <li>• <strong>Indie ($7/month):</strong> Perfect for solo producers</li>
                          <li>• <strong>Producer ($19/month):</strong> Great for professionals</li>
                          <li>• <strong>Studio ($49/month):</strong> Best for teams and labels</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-skribble-azure pl-4">
                        <h4 className="font-semibold text-skribble-sky mb-2">2. Upload Your First Beat</h4>
                        <ul className="text-sm text-skribble-azure/80 space-y-1">
                          <li>• Drag & drop your audio file anywhere on the project page</li>
                          <li>• Supported formats: MP3, WAV, AIFF, FLAC, M4A</li>
                          <li>• Maximum file size depends on your plan (50MB - 1GB)</li>
                          <li>• Add version notes to help collaborators understand changes</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-skribble-azure pl-4">
                        <h4 className="font-semibold text-skribble-sky mb-2">3. Invite Collaborators</h4>
                        <ul className="text-sm text-skribble-azure/80 space-y-1">
                          <li>• Click "Share Project" to generate a private link</li>
                          <li>• Send the link via email, text, or any messaging app</li>
                          <li>• Artists don't need accounts - they can collaborate instantly</li>
                          <li>• Set permissions: view-only, comment, or full collaboration</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* For Artists */}
                  <div className="bg-skribble-dark/30 border border-skribble-purple/20 rounded-lg p-6">
                    <h3 className="text-xl font-madimi text-skribble-sky mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      For Artists
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="border-l-4 border-skribble-purple pl-4">
                        <h4 className="font-semibold text-skribble-sky mb-2">1. Access the Project</h4>
                        <ul className="text-sm text-skribble-azure/80 space-y-1">
                          <li>• Click the invitation link (no signup required)</li>
                          <li>• Project loads instantly in your browser</li>
                          <li>• Audio begins loading automatically</li>
                          <li>• Familiarize yourself with the interface</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-skribble-purple pl-4">
                        <h4 className="font-semibold text-skribble-sky mb-2">2. Listen & Annotate</h4>
                        <ul className="text-sm text-skribble-azure/80 space-y-1">
                          <li>• Click anywhere on the waveform to add feedback</li>
                          <li>• Choose annotation type: comment, marker, voice note</li>
                          <li>• Set priority level: low, medium, high, critical</li>
                          <li>• Add detailed text or record voice explanations</li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-skribble-purple pl-4">
                        <h4 className="font-semibold text-skribble-sky mb-2">3. Track Progress</h4>
                        <ul className="text-sm text-skribble-azure/80 space-y-1">
                          <li>• @mention the producer to grab attention</li>
                          <li>• Reply to existing annotations for threaded conversations</li>
                          <li>• Mark feedback as resolved when addressed</li>
                          <li>• Give final approval when satisfied</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'features' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-madimi text-skribble-sky mb-6">🎛️ Core Features Guide</h2>
                
                <div className="grid gap-6">
                  <FeatureCard
                    icon={MessageCircle}
                    title="Precision Annotations"
                    description="Add timestamped feedback with millisecond precision"
                    details={[
                      "💬 Comments - General feedback and suggestions",
                      "📍 Markers - Structural points in the song",
                      "🎤 Voice Notes - Audio recordings up to 2 minutes",
                      "⚠️ Issues - Problems that need fixing",
                      "✅ Approvals - Sign-off on specific moments"
                    ]}
                  />
                  
                  <FeatureCard
                    icon={Users}
                    title="Real-Time Collaboration"
                    description="Work together seamlessly with live updates"
                    details={[
                      "Live cursor tracking - see where others are listening",
                      "Instant sync - new annotations appear immediately",
                      "Presence indicators - know who's online",
                      "@Mention system - notify specific collaborators",
                      "Threaded replies - organized conversations"
                    ]}
                  />

                  <FeatureCard
                    icon={Clock}
                    title="Version Control"
                    description="Track changes across multiple versions"
                    details={[
                      "Automatic versioning (v1.0, v1.1, v2.0)",
                      "Version notes for each upload",
                      "Side-by-side version comparison",
                      "Rollback to previous versions",
                      "Change tracking and history"
                    ]}
                  />
                </div>

                <div className="mt-8 bg-skribble-dark/30 border border-skribble-azure/20 rounded-lg p-6">
                  <h3 className="text-lg font-madimi text-skribble-sky mb-4">Priority Levels & Status Workflow</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-skribble-sky mb-3">Priority Levels</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                          <span className="text-skribble-azure">Critical - Must be fixed before release</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                          <span className="text-skribble-azure">High - Important for the song's success</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                          <span className="text-skribble-azure">Medium - Nice to have improvements</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                          <span className="text-skribble-azure">Low - Optional suggestions</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-skribble-sky mb-3">Status Workflow</h4>
                      <div className="flex items-center gap-2 text-sm text-skribble-azure">
                        <span>📋 Pending</span>
                        <ChevronRight className="w-3 h-3" />
                        <span>🔄 In Progress</span>
                        <ChevronRight className="w-3 h-3" />
                        <span>✅ Resolved</span>
                        <ChevronRight className="w-3 h-3" />
                        <span>👍 Approved</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    <div className="space-y-2 text-sm text-skribble-azure">
                      <p><code className="bg-skribble-dark/50 px-2 py-1 rounded">wss://api.skribble.io</code></p>
                      <p>Events: annotation-created, user-joined, project-updated</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'troubleshooting' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-madimi text-skribble-sky mb-6">🐛 Troubleshooting</h2>
                
                <div className="space-y-6">
                  <div className="bg-skribble-plum/20 border border-skribble-azure/20 rounded-lg p-6">
                    <h3 className="text-lg font-madimi text-skribble-sky mb-4">Audio Playback Problems</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-skribble-sky mb-2">Audio Won't Play</h4>
                        <ul className="space-y-1 text-sm text-skribble-azure">
                          <li>✓ Check browser audio permissions in settings</li>
                          <li>✓ Ensure audio isn't muted in browser tab</li>
                          <li>✓ Try refreshing the page to reload audio engine</li>
                          <li>✓ Clear browser cache and cookies</li>
                          <li>✓ Test with different browser or incognito mode</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-skribble-sky mb-2">Poor Audio Quality</h4>
                        <ul className="space-y-1 text-sm text-skribble-azure">
                          <li>✓ Check internet connection stability</li>
                          <li>✓ Close unnecessary browser tabs</li>
                          <li>✓ Disable browser extensions temporarily</li>
                          <li>✓ Try lower quality playback in settings</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-skribble-dark/30 border border-skribble-purple/20 rounded-lg p-6">
                    <h3 className="text-lg font-madimi text-skribble-sky mb-4">File Upload Issues</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-skribble-sky mb-2">Upload Failed Error</h4>
                        <ul className="space-y-1 text-sm text-skribble-azure">
                          <li>✓ Verify file format is supported (MP3, WAV, AIFF, FLAC, M4A)</li>
                          <li>✓ Check file size against your plan limits</li>
                          <li>✓ Ensure stable internet connection</li>
                          <li>✓ Try uploading smaller file to test</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-skribble-azure/10 border border-skribble-azure/30 rounded-lg p-6">
                    <h3 className="text-lg font-madimi text-skribble-sky mb-4">Getting Help</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-semibold text-skribble-sky mb-2">Support Channels</h4>
                        <ul className="space-y-1 text-skribble-azure">
                          <Link href="/contact" target="_blank" className="flex items-center gap-2 hover:text-skribble-sky transition-colors">
                          <li>📧 Skribble Support</li>
                          </Link>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-skribble-sky mb-2">What to Include</h4>
                        <ul className="space-y-1 text-skribble-azure">
                          <li>• Your account email and subscription</li>
                          <li>• Browser type and version</li>
                          <li>• Detailed issue description</li>
                          <li>• Steps you've already tried</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add other sections similarly... */}
          {activeSection === 'specs' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-madimi text-skribble-sky mb-6">📱 Platform Specifications</h2>
              
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-skribble-plum/20 border border-skribble-azure/20 rounded-lg p-6">
                  <h3 className="text-lg font-madimi text-skribble-sky mb-4">System Requirements</h3>
                  <div className="space-y-3 text-sm text-skribble-azure">
                    <p><strong>Browser:</strong> Chrome 90+, Firefox 88+, Safari 14+, Edge 90+</p>
                    <p><strong>RAM:</strong> 4GB minimum (8GB recommended)</p>
                    <p><strong>Internet:</strong> Stable broadband (10+ Mbps)</p>
                    <p><strong>Audio:</strong> Built-in or professional audio interface</p>
                  </div>
                </div>

                <div className="bg-skribble-dark/30 border border-skribble-purple/20 rounded-lg p-6">
                  <h3 className="text-lg font-madimi text-skribble-sky mb-4">Supported Formats</h3>
                  <div className="space-y-2 text-sm text-skribble-azure">
                    <p><strong>MP3:</strong> Up to 320kbps, all sample rates</p>
                    <p><strong>WAV:</strong> Uncompressed, up to 192kHz/32-bit</p>
                    <p><strong>AIFF:</strong> Apple format, full compatibility</p>
                    <p><strong>FLAC:</strong> Lossless compression</p>
                    <p><strong>M4A:</strong> Apple AAC format</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-12 h-12 bg-skribble-azure hover:bg-skribble-purple rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 z-50"
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
};

export default DocsPage;