"use client";
// frontend/src/app/page.tsx
import React, { useState } from 'react'
import Image from 'next/image';

import Link from 'next/link';
import { ArrowRight, Users, Zap, Download, Rocket, Music, MessageCircle, Clock, Check } from 'lucide-react';
import WaveformDemo from '@/components/WaveformDemo';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
      <div className="md:hidden relative">
        <button
          className="text-skribble-sky hover:text-skribble-azure transition-colors p-2"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label="Open mobile menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {mobileMenuOpen && (
          <div className="absolute right-0 mt-2 bg-skribble-dark rounded-lg shadow-lg flex flex-col gap-2 p-4 md:hidden z-50">
            <Link href="#features" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Features
            </Link>
            <Link href="quickstart" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Quickstart
            </Link>
            
            <Link href="#pricing" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Pricing
            </Link>
            <Link 
            href="/login" 
            className="text-skribble-sky hover:text-skribble-azure transition-colors"
          >
            Sign In
          </Link>
          <Link
            className="text-skribble-sky hover:text-skribble-azure transition-colors" 
            href="/register" 
          >Register</Link>
            <Link href="#about" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              About
            </Link>
          </div>
        )}
      </div>
        </div>
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Pricing
            </Link>
            <Link href="/quickstart" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Quickstart
            </Link>
            <Link href="#about" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              About
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
          <Link 
            href="/login" 
            className="text-skribble-sky hover:text-skribble-azure transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/register" 
            className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 sm:px-6 py-2 rounded-full hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 text-sm sm:text-base"
          >
            Get Started
          </Link>
        </div>
      </nav>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-7xl mx-auto text-center">
          <div className="relative inline-block mb-6 sm:mb-8">
            <h1 className="font-madimi text-5xl xs:text-6xl sm:text-7xl md:text-8xl bg-gradient-to-r from-skribble-sky via-skribble-azure to-skribble-purple bg-clip-text text-transparent">
              Skribble
            </h1>
            <div className="absolute -top-6 -right-6 sm:-top-8 sm:-right-12 bg-skribble-azure rounded-xl sm:rounded-2xl rounded-bl-md px-3 py-1.5 sm:px-4 sm:py-2 shadow-xl animate-float">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></div>
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
          
          <h2 className="text-xl xs:text-2xl sm:text-3xl text-skribble-sky mb-4 sm:mb-6 max-w-4xl mx-auto leading-relaxed">
            Where Music Meets Collaboration
          </h2>
          
          <p className="text-base xs:text-lg text-skribble-azure mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed">
            The professional platform for producers and artists to collaborate on music projects with precision timestamp annotations and seamless DAW integration.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-10 sm:mb-16">
            <Link 
              href="/register" 
              className="group bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-medium hover:shadow-2xl hover:shadow-skribble-azure/30 transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              Start Collaborating Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="/quickstart" 
              className="group flex items-center gap-2 sm:gap-3 text-skribble-sky hover:text-skribble-azure transition-colors"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Rocket className="w-5 h-5 sm:w-6 sm:h-6 ml-1" />
              </div>
              <span className="text-base sm:text-lg">View Quickstart Guide</span>
            </Link>
          </div>

          {/* Logo Section */}
          <div className="flex justify-center mb-10 sm:mb-16">
            <div className="relative group">
              <Image 
                className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 drop-shadow-2xl transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_30px_rgba(0,195,255,0.3)]" 
                src="/Skribblelogo.png" 
                alt="Skribble Logo" 
                width={250} 
                height={250} 
                priority
              />
              
              {/* Floating Chat Bubbles */}
              <div className="absolute top-12 -left-24 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 group-hover:animate-bounce">
                <div className="bg-skribble-azure text-white px-3 py-2 rounded-full text-xs sm:text-sm font-medium shadow-lg">
                  🎵 "Sounds great!"
                </div>
                <div className="w-3 h-3 bg-skribble-azure rotate-45 absolute -bottom-1 left-4"></div>
              </div>
              
              <div className="absolute -top-6 right-8 opacity-0 group-hover:opacity-100 transition-all duration-700 delay-200 group-hover:animate-pulse">
                <div className="bg-skribble-purple text-white px-3 py-2 rounded-full text-xs sm:text-sm font-medium shadow-lg">
                  💫 "Perfect timing"
                </div>
                <div className="w-3 h-3 bg-skribble-purple rotate-45 absolute -bottom-1 left-4"></div>
              </div>
              
              <div className="absolute top-8 -right-20 opacity-0 group-hover:opacity-100 transition-all duration-600 delay-300 group-hover:animate-bounce">
                <div className="bg-skribble-sky text-black px-3 py-2 rounded-full text-xs sm:text-sm font-medium shadow-lg">
                  🔥 "Love this beat!"
                </div>
                <div className="w-3 h-3 bg-skribble-sky rotate-45 absolute -bottom-1 left-4"></div>
              </div>
              
              <div className="absolute bottom-16 -left-20 opacity-0 group-hover:opacity-100 transition-all duration-800 delay-150 group-hover:animate-pulse">
                <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-3 py-2 rounded-full text-xs sm:text-sm font-medium shadow-lg">
                  ✨ "Epic collab!"
                </div>
                <div className="w-3 h-3 bg-skribble-azure rotate-45 absolute -bottom-1 right-28"></div>
              </div>
              
              <div className="absolute bottom-2 -right-20 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-400 group-hover:animate-bounce">
                <div className="bg-skribble-plum text-white px-3 py-2 rounded-full text-xs sm:text-sm font-medium shadow-lg">
                  🎶 "More reverb?"
                </div>
                <div className="w-3 h-3 bg-skribble-plum rotate-45 absolute -bottom-1 left-3"></div>
              </div>
              
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-skribble-azure/20 to-skribble-purple/20 blur-xl group-hover:blur-2xl transition-all duration-300 opacity-0 group-hover:opacity-100"></div>
            </div>
          </div>

          {/* Demo Waveform */}
          <div className="mx-auto max-w-full overflow-x-auto">
            <WaveformDemo />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-madimi text-4xl md:text-5xl text-skribble-sky mb-6">
              Powerful Features
            </h2>
            <p className="text-lg text-skribble-azure max-w-2xl mx-auto">
              Everything you need for seamless music collaboration between producers and artists
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature cards */}
            {[
              {
                icon: MessageCircle,
                title: "Precision Annotations",
                description: "Add timestamped comments, voice notes, and markers with millisecond precision."
              },
              {
                icon: Users,
                title: "Real-time Collaboration",
                description: "Invite collaborators with reusable links. See cursors and comments in real-time as you work together."
              },
              {
                icon: Download,
                title: "DAW Integration",
                description: "Export projects with embedded markers to Reaper, Pro Tools, Logic, and more."
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Optimized for professional workflows with instant loading and smooth playback."
              },
              {
                icon: Clock,
                title: "Version Control",
                description: "Track changes across versions with automatic backup and revision history."
              },
              {
                icon: Music,
                title: "Pro Audio Support",
                description: "Support for all major audio formats with high-quality waveform visualization."
              }
            ].map((feature, index) => (
              <div 
                key={index} 
                className="group bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20 hover:border-skribble-azure/40 transition-all duration-300 hover:transform hover:scale-105"
              >
                <div className="w-16 h-16 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-2xl flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-skribble-azure/25 transition-all duration-300">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">{feature.title}</h3>
                <p className="text-skribble-azure leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-madimi text-4xl md:text-5xl text-skribble-sky mb-6">
              Simple Pricing
            </h2>
            <p className="text-lg text-skribble-azure max-w-2xl mx-auto">
              Choose the plan that fits your collaboration needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Pricing cards */}
            {[
              {
                name: "Indie",
                price: "$7",
                description: "Perfect for solo producers",
                features: ["5 active projects", "2 collaborators", "50MB files", "Basic exports"],
                popular: false
              },
              {
                name: "Producer",
                price: "$19",
                description: "For serious professionals",
                features: ["25 projects", "10 collaborators", "200MB files", "All export formats", "Voice notes", "Priority support"],
                popular: true
              },
              {
                name: "Studio",
                price: "$49",
                description: "For teams and labels",
                features: ["Unlimited projects", "Unlimited collaborators", "1GB files", "White-label options", "Advanced analytics", "24/7 support"],
                popular: false
              }
            ].map((plan, index) => (
              <div 
                key={index} 
                className={`relative bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border transition-all duration-300 hover:transform hover:scale-105 ${
                  plan.popular 
                    ? 'border-skribble-azure shadow-lg shadow-skribble-azure/25' 
                    : 'border-skribble-azure/20 hover:border-skribble-azure/40'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="font-madimi text-2xl text-skribble-sky mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-skribble-azure">{plan.price}</span>
                    <span className="text-skribble-purple">/month</span>
                  </div>
                  <p className="text-skribble-azure">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-skribble-azure flex-shrink-0" />
                      <span className="text-skribble-sky">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link 
                  href={`/register?plan=${plan.name.toLowerCase()}`}
                  className={`w-full py-3 rounded-full font-medium transition-all duration-300 block text-center ${
                    plan.popular
                      ? 'bg-gradient-to-r from-skribble-azure to-skribble-purple text-white hover:shadow-lg hover:shadow-skribble-azure/25 hover:scale-105'
                      : 'border border-skribble-azure text-skribble-azure hover:bg-skribble-azure hover:text-white'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-skribble-purple to-skribble-azure">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-madimi text-4xl md:text-5xl text-white mb-6">
            Ready to Transform Your Music Collaboration?
          </h2>
          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Join thousands of producers and artists already using Skribble to create better music together.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link 
              href="/register" 
              className="group bg-white text-skribble-purple px-8 py-4 rounded-full text-lg font-medium hover:shadow-2xl hover:shadow-black/20 transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              Start Free Today
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="/demo" 
              className="text-white hover:text-white/80 transition-colors text-lg"
            >
              Schedule a Demo →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-skribble-dark px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Logo and description */}
            <div className="md:col-span-2">
              <div className="relative inline-block mb-4">
                <h3 className="font-madimi text-2xl text-skribble-sky">Skribble</h3>
                <div className="absolute -top-2 -right-3 bg-skribble-azure rounded-lg rounded-bl-sm px-2 py-1">
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              <p className="text-skribble-azure leading-relaxed max-w-md">
                Revolutionizing music collaboration with precision annotation tools and seamless DAW integration.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-medium text-skribble-sky mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link href="/features" className="text-skribble-azure hover:text-skribble-sky transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="text-skribble-azure hover:text-skribble-sky transition-colors">Pricing</Link></li>
                <li><Link href="/integrations" className="text-skribble-azure hover:text-skribble-sky transition-colors">Integrations</Link></li>
                <li><Link href="/changelog" className="text-skribble-azure hover:text-skribble-sky transition-colors">Changelog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-skribble-sky mb-4">Support</h4>
              <ul className="space-y-2">
                <li><Link href="/quickstart" className="text-skribble-azure hover:text-skribble-sky transition-colors">Quickstart Guide</Link></li>
                <li><Link href="/docs" className="text-skribble-azure hover:text-skribble-sky transition-colors">Documentation</Link></li>
                <li><Link href="/contact" className="text-skribble-azure hover:text-skribble-sky transition-colors">Contact</Link></li>
                <li><Link href="/status" className="text-skribble-azure hover:text-skribble-sky transition-colors">Status</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-skribble-plum pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-skribble-purple text-sm">
              © 2024 Skribble. All rights reserved.
            </p>
            <div className="flex items-center gap-6 mt-4 md:mt-0">
              <Link href="/privacy" className="text-skribble-purple hover:text-skribble-azure transition-colors text-sm">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-skribble-purple hover:text-skribble-azure transition-colors text-sm">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}