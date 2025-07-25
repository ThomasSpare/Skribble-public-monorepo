// frontend/src/app/quickstart/page.tsx
import Link from 'next/link';
import { 
  ArrowLeft, 
  Play, 
  Upload, 
  Users, 
  MessageCircle, 
  AlertTriangle, 
  MapPin, 
  CheckCircle, 
  Mic, 
  Download,
  Keyboard,
  HelpCircle,
  ArrowRight,
  Clock,
  Settings,
  Zap,
  Music
} from 'lucide-react';

export default function QuickstartPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="relative z-50 px-6 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="relative">
            <h1 className="font-madimi text-3xl text-skribble-sky">
              Skribble
            </h1>
            <div className="absolute -top-3 -right-4 bg-skribble-azure rounded-xl rounded-bl-sm px-2 py-1 shadow-lg animate-float">
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Features
            </Link>
            <Link href="/#pricing" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Pricing
            </Link>
            <Link href="/quickstart" className="text-skribble-azure">
              Quickstart
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-skribble-sky hover:text-skribble-azure transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/register" 
              className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-2 rounded-full hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Back Link */}
      <div className="px-6 pb-4">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-skribble-azure hover:text-skribble-sky transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className="px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-skribble-azure/20 text-skribble-azure px-4 py-2 rounded-full text-sm mb-6">
            <Zap className="w-4 h-4" />
            Get started in under 5 minutes
          </div>
          
          <h1 className="font-madimi text-5xl md:text-6xl bg-gradient-to-r from-skribble-sky via-skribble-azure to-skribble-purple bg-clip-text text-transparent mb-6">
            Quickstart Guide
          </h1>
          
          <p className="text-xl text-skribble-azure mb-8 max-w-2xl mx-auto">
            Learn how to collaborate on music projects with precision timestamp annotations. Think "Google Docs for music" - add comments and feedback at exact moments in your tracks.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/register" 
              className="group bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-8 py-3 rounded-full font-medium hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              Start Free Today
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="#workflow" 
              className="text-skribble-sky hover:text-skribble-azure transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Watch the workflow
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto space-y-16">

          {/* Quick Overview */}
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
            <h2 className="font-madimi text-3xl text-skribble-sky mb-6">What is Skribble?</h2>
            <p className="text-lg text-skribble-azure leading-relaxed mb-6">
              Skribble is a professional platform where <strong className="text-skribble-sky">producers</strong> and <strong className="text-skribble-sky">artists</strong> collaborate on music projects using precision timestamp annotations.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-skribble-dark/40 rounded-xl p-6">
                <Music className="w-12 h-12 text-skribble-azure mb-4" />
                <h3 className="font-medium text-skribble-sky mb-2">For Producers</h3>
                <p className="text-skribble-azure text-sm">Upload beats, get precise feedback, and export projects back to your DAW with embedded markers.</p>
              </div>
              <div className="bg-skribble-dark/40 rounded-xl p-6">
                <Users className="w-12 h-12 text-skribble-azure mb-4" />
                <h3 className="font-medium text-skribble-sky mb-2">For Artists</h3>
                <p className="text-skribble-azure text-sm">Listen to tracks and add timestamped comments, voice notes, and suggestions - no account required!</p>
              </div>
            </div>
          </div>

          {/* Producer Workflow */}
          <div id="workflow">
            <h2 className="font-madimi text-4xl text-skribble-sky mb-8 text-center">For Producers</h2>
            
            <div className="space-y-8">
              {/* Step 1 */}
              <div className="flex gap-6 items-start">
                <div className="w-12 h-12 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  1
                </div>
                <div className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 flex-1 border border-skribble-azure/10">
                  <h3 className="font-medium text-skribble-sky text-xl mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Create Your Account
                  </h3>
                  <ul className="text-skribble-azure space-y-2">
                    <li>• Visit skribble.com and click <strong>"Get Started"</strong></li>
                    <li>• Sign up with email/password or social login</li>
                    <li>• Choose <strong>"Producer"</strong> as your role</li>
                    <li>• Complete your profile with stage name and bio</li>
                  </ul>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-6 items-start">
                <div className="w-12 h-12 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  2
                </div>
                <div className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 flex-1 border border-skribble-azure/10">
                  <h3 className="font-medium text-skribble-sky text-xl mb-3 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Create Your First Project
                  </h3>
                  <ul className="text-skribble-azure space-y-2">
                    <li>• Click <strong>"+ New Project"</strong> on your dashboard</li>
                    <li>• Enter title: "Summer Anthem v1.0"</li>
                    <li>• Set collaboration deadline (optional)</li>
                    <li>• Configure permissions and privacy settings</li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-6 items-start">
                <div className="w-12 h-12 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  3
                </div>
                <div className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 flex-1 border border-skribble-azure/10">
                  <h3 className="font-medium text-skribble-sky text-xl mb-3 flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Upload Your Track
                  </h3>
                  <ul className="text-skribble-azure space-y-2">
                    <li>• <strong>Drag & drop</strong> your audio file or click "Upload Audio"</li>
                    <li>• Supported: MP3, WAV, FLAC, M4A (up to 200MB)</li>
                    <li>• Wait for waveform generation (10-30 seconds)</li>
                    <li>• Your track is ready for collaboration!</li>
                  </ul>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-6 items-start">
                <div className="w-12 h-12 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  4
                </div>
                <div className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 flex-1 border border-skribble-azure/10">
                  <h3 className="font-medium text-skribble-sky text-xl mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Invite Collaborators
                  </h3>
                  <ul className="text-skribble-azure space-y-2">
                    <li>• Click <strong>"Share"</strong> button in your project</li>
                    <li>• Copy private share link and send to artists</li>
                    <li>• Or enter email addresses for invitations</li>
                    <li>• Set permissions: View-only, Comment, or Full Edit</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Artist Workflow */}
          <div>
            <h2 className="font-madimi text-4xl text-skribble-sky mb-8 text-center">For Artists</h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 border border-skribble-azure/10">
                <h3 className="font-medium text-skribble-sky text-xl mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Join a Project
                </h3>
                <ul className="text-skribble-azure space-y-2 text-sm">
                  <li>• <strong>No account required!</strong></li>
                  <li>•  Paste the share link you received in your browser</li>
                  <li>• Or create a free account for extra features</li>
                  <li>• You'll see the project with audio and waveform</li>
                  <li>• You can Make annotations and voice notes</li>
                  <li>• Bookmark the project page so you can return to it !</li>
                </ul>
              </div>

              <div className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 border border-skribble-azure/10">
                <h3 className="font-medium text-skribble-sky text-xl mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Listen and Collaborate
                </h3>
                <ul className="text-skribble-azure space-y-2 text-sm">
                  <li>• Click <strong>Play</strong> to start the track</li>
                  <li>• <strong>Click on waveform</strong> to jump to timestamp</li>
                  <li>• <strong>Add feedback</strong> by clicking where you want to comment</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Annotation Types */}
          <div>
            <h2 className="font-madimi text-4xl text-skribble-sky mb-8 text-center">Annotation Types</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: MessageCircle,
                  emoji: '💬',
                  type: 'Comment',
                  purpose: 'General feedback',
                  example: '"Love this melody!"',
                  color: 'from-skribble-azure to-blue-500'
                },
                {
                  icon: AlertTriangle,
                  emoji: '⚠️',
                  type: 'Issue',
                  purpose: 'Problems to fix',
                  example: '"Vocals too quiet here"',
                  color: 'from-red-500 to-red-600'
                },
                {
                  icon: MapPin,
                  emoji: '📍',
                  type: 'Marker',
                  purpose: 'Section labels',
                  example: '"Verse 1 starts"',
                  color: 'from-skribble-purple to-purple-600'
                },
                {
                  icon: CheckCircle,
                  emoji: '✅',
                  type: 'Approval',
                  purpose: 'Sign-off',
                  example: '"This section is perfect!"',
                  color: 'from-green-500 to-green-600'
                }
              ].map((annotation, index) => (
                <div key={index} className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 border border-skribble-azure/10 text-center">
                  <div className={`w-16 h-16 bg-gradient-to-r ${annotation.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-2xl">{annotation.emoji}</span>
                  </div>
                  <h3 className="font-medium text-skribble-sky text-lg mb-2">{annotation.type}</h3>
                  <p className="text-skribble-azure text-sm mb-2">{annotation.purpose}</p>
                  <p className="text-skribble-sky text-xs italic">{annotation.example}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Levels */}
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
            <h2 className="font-madimi text-3xl text-skribble-sky mb-6 text-center">Priority Levels</h2>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { level: 'Low', desc: 'Nice-to-have suggestions', color: 'bg-green-500/20 text-green-400' },
                { level: 'Medium', desc: 'Important improvements', color: 'bg-yellow-500/20 text-yellow-400' },
                { level: 'High', desc: 'Must-fix issues', color: 'bg-orange-500/20 text-orange-400' },
                { level: 'Critical', desc: 'Blocking problems', color: 'bg-red-500/20 text-red-400' }
              ].map((priority, index) => (
                <div key={index} className={`${priority.color} rounded-lg p-4 text-center`}>
                  <div className="font-medium mb-1">{priority.level}</div>
                  <div className="text-xs opacity-80">{priority.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Step by Step Tutorial */}
          <div>
            <h2 className="font-madimi text-4xl text-skribble-sky mb-8 text-center">Adding Your First Comment</h2>
            
            <div className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-8 border border-skribble-azure/10">
              <div className="space-y-6">
                {[
                  '🎵 Play the track and listen for a moment you want to comment on',
                  '⏸️ Pause at that timestamp (or click on the waveform)',
                  '💬 Click the annotation button that appears',
                  '✍️ Type your feedback: "The kick drum sounds muddy here - maybe EQ out some low-mids?"',
                  '🎯 Set priority: Choose "High" for important issues',
                  '✅ Click "Add Comment"'
                ].map((step, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-skribble-azure rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {index + 1}
                    </div>
                    <p className="text-skribble-azure">{step}</p>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 p-6 bg-skribble-azure/10 rounded-lg border border-skribble-azure/20">
                <p className="text-skribble-sky font-medium">✨ Your annotation appears as a colored bubble above the waveform!</p>
              </div>
            </div>
          </div>

          {/* Advanced Features */}
          <div>
            <h2 className="font-madimi text-4xl text-skribble-sky mb-8 text-center">Advanced Features</h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Clock,
                  title: 'Version Control',
                  features: ['Upload multiple versions: v1.0, v1.1, v2.0', 'Compare changes between versions', 'All annotations stay linked to timestamps']
                },
                {
                  icon: Mic,
                  title: 'Voice Notes (free for artists)',
                  features: ['Click the 🎤 Voice Note button', 'Record feedback (up to 2 minutes)', 'Perfect for explaining complex musical ideas']
                },
                {
                  icon: Download,
                  title: 'DAW Export',
                  features: ['Export to Reaper (.rpp)', 'Pro Tools (.ptxt)', 'Logic Pro (.logic)', 'Ableton Live (.als)', 'Universal (.wav with cue points)']
                }
              ].map((feature, index) => (
                <div key={index} className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 border border-skribble-azure/10">
                  <div className="w-12 h-12 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-xl flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-medium text-skribble-sky text-lg mb-4">{feature.title}</h3>
                  <ul className="text-skribble-azure text-sm space-y-2">
                    {feature.features.map((item, idx) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tips */}
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
            <h2 className="font-madimi text-3xl text-skribble-sky mb-6 text-center">💡 Pro Tips</h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-medium text-skribble-azure text-lg mb-4">For Producers</h3>
                <ul className="text-skribble-sky space-y-2 text-sm">
                  <li>• Be specific in project titles: "Trap Beat #47 - Need vocal feedback"</li>
                  <li>• Set clear deadlines to keep collaborations moving</li>
                  <li>• Use version numbers (v1.0, v1.1) for easy tracking</li>
                  <li>• Respond quickly to feedback to maintain momentum</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-skribble-azure text-lg mb-4">For Artists</h3>
                <ul className="text-skribble-sky space-y-2 text-sm">
                  <li>• Listen multiple times before giving feedback</li>
                  <li>• Be constructive: Suggest solutions, not just problems</li>
                  <li>• Use priority levels wisely - not everything is "Critical"</li>
                  <li>• Give positive feedback too - say what's working!</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <h2 className="font-madimi text-4xl text-skribble-sky mb-8 text-center flex items-center justify-center gap-3">
              <Keyboard className="w-8 h-8" />
              Keyboard Shortcuts
            </h2>
            
            <div className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-8 border border-skribble-azure/10">
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { action: 'Play/Pause', shortcut: 'Spacebar' },
                  { action: 'Jump backward', shortcut: 'Left Arrow' },
                  { action: 'Jump forward', shortcut: 'Right Arrow' },
                  { action: 'Add comment', shortcut: 'C' },
                  { action: 'Add marker', shortcut: 'M' },
                  { action: 'Zoom in', shortcut: '+' },
                  { action: 'Zoom out', shortcut: '-' }
                ].map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-skribble-dark/40 rounded-lg">
                    <span className="text-skribble-sky">{shortcut.action}</span>
                    <kbd className="bg-skribble-azure/20 text-skribble-azure px-3 py-1 rounded text-sm font-mono">
                      {shortcut.shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h2 className="font-madimi text-4xl text-skribble-sky mb-8 text-center flex items-center justify-center gap-3">
              <HelpCircle className="w-8 h-8" />
              Common Questions
            </h2>
            
            <div className="space-y-6">
              {[
                {
                  q: 'Can I use Skribble without creating an account?',
                  a: 'Yes! Artists can view and comment on projects using private links without signing up.'
                },
                {
                  q: 'What audio formats are supported?',
                  a: 'MP3, WAV, FLAC, M4A, and most common formats. Files up to 200MB (Producer plan) or 1GB (Studio plan).'
                },
                {
                  q: 'How do I handle disagreements about feedback?',
                  a: 'Use threaded replies to discuss specific points. The producer typically has final creative control.'
                },
                {
                  q: 'Can I work on multiple projects simultaneously?',
                  a: 'Yes! Your plan determines how many active projects you can have (5 for Indie, 25 for Producer, unlimited for Studio).'
                }
              ].map((faq, index) => (
                <div key={index} className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl p-6 border border-skribble-azure/10">
                  <h3 className="font-medium text-skribble-sky text-lg mb-3">{faq.q}</h3>
                  <p className="text-skribble-azure">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-2xl p-8 text-center">
            <h2 className="font-madimi text-3xl text-white mb-4">Ready to Collaborate?</h2>
            <p className="text-white/90 mb-6 text-lg">Start creating better music together!</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/register" 
                className="bg-white text-skribble-purple px-8 py-3 rounded-full font-medium hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                Sign up for free
              </Link>
              <Link 
                href="/contact" 
                className="text-white hover:text-white/80 transition-colors"
              >
                Need help? Contact support →
              </Link>
            </div>
          </div>

          {/* Quote */}
          <div className="text-center">
            <blockquote className="text-lg text-skribble-azure italic">
              "The whole is greater than the sum of its parts."
            </blockquote>
            <cite className="text-skribble-purple text-sm">- Aristotle</cite>
            <p className="text-skribble-sky text-sm mt-2">Perfect collaboration creates music that neither artist could make alone. Welcome to Skribble! 🎶</p>
          </div>

        </div>
      </section>
    </div>
  );
}