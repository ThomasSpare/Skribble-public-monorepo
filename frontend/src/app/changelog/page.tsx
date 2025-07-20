"use client";

import React from 'react';
import { ArrowLeft, Zap, Users, Music, Shield, Rocket, Download, Settings, MessageCircle, Upload, Database, Smartphone, Brain, Globe, Plug } from 'lucide-react';


const ChangelogPage = () => {
  const updates = [
    {
      version: "1.0.0",
      date: "July 19, 2025",
      title: "🚀 Official Launch - The Future of Music Collaboration",
      type: "major",
      quote: "The best way to predict the future is to invent it. - Alan Kay",
      features: [
        { icon: Music, title: "Core Audio Engine", description: "Professional-grade audio playback with millisecond precision" },
        { icon: MessageCircle, title: "Annotation System", description: "Timestamped comments, voice notes, and section markers" },
        { icon: Users, title: "Real-time Collaboration", description: "Live cursor tracking and instant notifications" },
        { icon: Settings, title: "Version Control", description: "Track changes across multiple versions (v1.0, v1.1, v2.0)" },
        { icon: Download, title: "DAW Integration", description: "Export to Reaper, Pro Tools, Logic Pro, and Ableton Live" },
        { icon: Shield, title: "Subscription System", description: "Indie ($7), Producer ($19), and Studio ($49) tiers" }
      ],
      technical: [
        "Next.js 14 with React 18 and Tailwind CSS",
        "Node.js with Express and Socket.IO for real-time features", 
        "PostgreSQL with optimized schemas for audio data",
        "AWS S3 for secure, scalable file storage",
        "Stripe integration with subscription management",
        "FFmpeg for waveform generation and format conversion"
      ]
    },
    {
      version: "0.9.0",
      date: "July 10, 2025", 
      title: "🧪 Release Candidate - Final Testing Phase",
      type: "minor",
      features: [
        { icon: Music, title: "Enhanced Playback", description: "Improved audio quality and browser compatibility" },
        { icon: Upload, title: "Format Support", description: "Added FLAC and M4A support alongside MP3, WAV, AIFF" },
        { icon: Users, title: "Real-time Sync", description: "WebSocket-based live collaboration" },
        { icon: Settings, title: "Dark Theme", description: "Professional dark interface optimized for studios" }
      ]
    },
    {
      version: "0.8.0",
      date: "June 28, 2025",
      title: "⚡ Beta Release - Core Features Complete", 
      type: "minor",
      features: [
        { icon: Shield, title: "Stripe Integration", description: "Secure payment processing" },
        { icon: Download, title: "DAW Export Features", description: "Reaper, Pro Tools, Logic Pro export support" },
        { icon: Database, title: "Analytics Dashboard", description: "Project metrics and usage statistics" }
      ]
    },
    {
      version: "0.7.0",
      date: "June 15, 2025",
      title: "🎤 Voice Notes & Advanced Annotations",
      type: "minor", 
      features: [
        { icon: MessageCircle, title: "Voice Annotation System", description: "Browser-based audio recording" },
        { icon: Settings, title: "Enhanced Text Annotations", description: "Rich text editor and @mention system" },
        { icon: Settings, title: "Version Management", description: "Smart version numbering and notes" }
      ]
    },
    {
      version: "0.6.0",
      date: "June 1, 2025",
      title: "🎯 Project Management & Permissions",
      type: "minor",
      features: [
        { icon: Users, title: "User Roles & Permissions", description: "Producer, Artist, Viewer, Admin roles" },
        { icon: Settings, title: "Project Templates", description: "Beat review, song feedback, mix notes templates" },
        { icon: Settings, title: "Deadline Management", description: "Project deadlines and automated reminders" }
      ]
    }
  ];

  const comingSoon = [
    { icon: Smartphone, title: "Mobile Applications", description: "Native iOS and Android apps with offline mode" },
    { icon: Brain, title: "AI-Powered Features", description: "Smart suggestions and auto-transcription" },
    { icon: Globe, title: "Enterprise Features", description: "White-label solution and SSO integration" },
    { icon: Plug, title: "Advanced DAW Integration", description: "Native DAW plugins for seamless integration" }
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'major': return 'from-green-500 to-emerald-600';
      case 'minor': return 'from-skribble-azure to-skribble-purple';
      default: return 'from-skribble-purple to-skribble-plum';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'major': return <Rocket className="w-5 h-5" />;
      case 'minor': return <Zap className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="relative z-50 px-6 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="relative">
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
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4">
            <a 
              href="/" 
              className="flex items-center gap-2 text-skribble-sky hover:text-skribble-azure transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </a>
            <a 
              href="/register" 
              className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-2 rounded-full hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105"
            >
              Get Started
            </a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-skribble-azure/20 backdrop-blur-sm rounded-full px-6 py-3 mb-8">
            <Settings className="w-5 h-5 text-skribble-azure" />
            <span className="text-skribble-azure font-medium">Product Updates</span>
          </div>
          
          <h1 className="font-madimi text-5xl md:text-7xl text-skribble-sky mb-6">
            What's New
          </h1>
          <p className="text-xl text-skribble-azure max-w-2xl mx-auto leading-relaxed">
            Stay up to date with the latest features, improvements, and updates to the Skribble platform
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="px-6 py-12">
        <div className="max-w-4xl mx-auto">
          
          {/* Latest Update Highlight */}
          <div className="mb-16">
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-600/20 backdrop-blur-sm rounded-2xl border border-green-500/20 p-8 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-2">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-madimi text-white">Version 1.0.0</h2>
                  <p className="text-green-200">July 19, 2025</p>
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-3">
                🚀 Official Launch - The Future of Music Collaboration
              </h3>
              
              <blockquote className="italic text-green-100 mb-6 border-l-4 border-green-400 pl-4">
                "The best way to predict the future is to invent it." - Alan Kay
              </blockquote>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {updates[0].features.map((feature, index) => (
                  <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-green-500/30 rounded-lg p-2 mt-1">
                        <feature.icon className="w-4 h-4 text-green-200" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white mb-1">{feature.title}</h4>
                        <p className="text-sm text-green-100">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="font-medium text-white mb-3">Technical Implementation</h4>
                <div className="grid md:grid-cols-2 gap-2">
                  {updates[0].technical?.map((tech, index) => (
                    <div key={index} className="flex items-center gap-2 text-green-100 text-sm">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                      {tech}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Previous Updates */}
          <div className="space-y-8">
            <h2 className="text-3xl font-madimi text-skribble-sky mb-8">Previous Updates</h2>
            
            {updates.slice(1).map((update, index) => (
              <div key={update.version} className="bg-skribble-plum/20 backdrop-blur-sm rounded-xl border border-skribble-azure/10 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`bg-gradient-to-r ${getTypeColor(update.type)} rounded-lg p-2`}>
                    {getTypeIcon(update.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-madimi text-skribble-sky">Version {update.version}</h3>
                      <span className="bg-skribble-azure/20 text-skribble-azure px-3 py-1 rounded-full text-sm">
                        {update.date}
                      </span>
                    </div>
                    <h4 className="text-lg text-skribble-azure mt-1">{update.title}</h4>
                  </div>
                </div>

                {update.quote && (
                  <blockquote className="italic text-skribble-azure/80 mb-4 border-l-4 border-skribble-azure/30 pl-4">
                    {update.quote}
                  </blockquote>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {update.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="bg-skribble-dark/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-skribble-azure/20 rounded-lg p-2 mt-1">
                          <feature.icon className="w-4 h-4 text-skribble-azure" />
                        </div>
                        <div>
                          <h5 className="font-medium text-skribble-sky mb-1">{feature.title}</h5>
                          <p className="text-sm text-skribble-azure/80">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Coming Soon Section */}
          <div className="mt-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-madimi text-skribble-sky mb-4">Coming Soon</h2>
              <p className="text-skribble-azure">Features we're working on for future releases</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {comingSoon.map((feature, index) => (
                <div key={index} className="bg-gradient-to-br from-skribble-azure/10 to-skribble-purple/10 backdrop-blur-sm rounded-xl border border-skribble-azure/20 p-6 hover:border-skribble-azure/40 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-lg p-3">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-skribble-sky mb-2">{feature.title}</h3>
                      <p className="text-skribble-azure/80">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Newsletter Signup */}
          <div className="mt-16 bg-gradient-to-r from-skribble-azure/20 to-skribble-purple/20 backdrop-blur-sm rounded-2xl border border-skribble-azure/20 p-8 text-center">
            <h3 className="text-2xl font-madimi text-skribble-sky mb-4">Stay Updated</h3>
            <p className="text-skribble-azure mb-6">
              Get notified about new features, updates, and product announcements
            </p>
            <div className="flex max-w-md mx-auto gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 bg-skribble-dark/50 border border-skribble-azure/30 rounded-lg text-skribble-sky placeholder-skribble-azure/50 focus:outline-none focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20"
              />
              <button className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105">
                Subscribe
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-skribble-azure/20 text-center">
            <p className="text-skribble-azure/60 mb-4">
              For technical support or feature requests, contact us at{' '}
              <a href="mailto:support@skribble.io" className="text-skribble-azure hover:text-skribble-sky">
                support@skribble.io
              </a>
            </p>
            <p className="text-skribble-azure/60">
              Follow our development:{' '}
              <a href="https://twitter.com/SkribbleApp" className="text-skribble-azure hover:text-skribble-sky">
                @SkribbleApp
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ChangelogPage;