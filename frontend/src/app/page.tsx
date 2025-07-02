// frontend/src/app/page.tsx
import Link from 'next/link';
import { ArrowRight, Play, Users, Zap, Download, Star, Rocket, Music, MessageCircle, Clock, Check } from 'lucide-react';
import WaveformDemo from '@/components/WaveformDemo';

export default function LandingPage() {
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

      {/* Hero Section */}
      <section className="relative px-6 py-20">
        <div className="max-w-7xl mx-auto text-center">
          <div className="relative inline-block mb-8">
            <h1 className="font-madimi text-7xl md:text-8xl bg-gradient-to-r from-skribble-sky via-skribble-azure to-skribble-purple bg-clip-text text-transparent">
              Skribble
            </h1>
            <div className="absolute -top-8 -right-12 bg-skribble-azure rounded-2xl rounded-bl-md px-4 py-2 shadow-xl animate-float">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
          
          <h2 className="text-2xl md:text-3xl text-skribble-sky mb-6 max-w-4xl mx-auto leading-relaxed">
            Where Music Meets Collaboration
          </h2>
          
          <p className="text-lg text-skribble-azure mb-12 max-w-3xl mx-auto leading-relaxed">
            The professional platform for producers and artists to collaborate on music projects with precision timestamp annotations and seamless DAW integration.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
            <Link 
              href="/register" 
              className="group bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-8 py-4 rounded-full text-lg font-medium hover:shadow-2xl hover:shadow-skribble-azure/30 transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              Start Collaborating Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="group flex items-center gap-3 text-skribble-sky hover:text-skribble-azure transition-colors">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <Link 
                href="/quickstart" 
                className="group flex items-center gap-3 text-skribble-sky hover:text-skribble-azure transition-colors"
              >
                <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Rocket className="w-6 h-6 ml-1" />
                </div>
                <span className="text-lg">View Quickstart Guide</span>
              </Link>
              </div>
            </button>
          </div>

          {/* Demo Waveform */}
          <WaveformDemo />
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
                description: "See collaborators' cursors and comments in real-time as you work together."
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

                <button className={`w-full py-3 rounded-full font-medium transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-skribble-azure to-skribble-purple text-white hover:shadow-lg hover:shadow-skribble-azure/25 hover:scale-105'
                    : 'border border-skribble-azure text-skribble-azure hover:bg-skribble-azure hover:text-white'
                }`}>
                  Get Started
                </button>
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