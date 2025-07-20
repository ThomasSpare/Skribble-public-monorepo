"use client";

import React, { useState } from 'react';
import { Mail, User, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';


const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          to: 'damrec.prod@gmail.com'
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === 'success') {
    return (
        <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
              {/* Header */}
      <header className="relative z-50 px-6 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="relative">
            <h1 className="font-madimi text-3xl text-skribble-sky">
              <Link href="/" className="text-skribble-sky">
                Skribble
              </Link>
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
      <div className="max-w-2xl mx-auto">
        <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-skribble-sky mb-2">Message Sent!</h3>
            <p className="text-skribble-azure mb-6">
              Thanks for reaching out! We'll get back to you within 24 hours.
            </p>
            <button
              onClick={() => setSubmitStatus(null)}
              className="px-6 py-2 bg-skribble-azure text-skribble-dark rounded-lg hover:bg-skribble-sky transition-colors"
            >
              Send Another Message
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      <header className="relative z-50 px-6 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="relative">
            <h1 className="font-madimi text-3xl text-skribble-sky">
              <Link href="/" className="text-skribble-sky">
                Skribble
              </Link>
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
    <div className="max-w-2xl mx-auto">
                    {/* Header */}
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
        <div className="text-center mb-8">
          <h2 className="font-madimi text-3xl text-skribble-sky mb-2">Get in Touch</h2>
          <p className="text-skribble-azure">
            Have questions or feedback? We'd love to hear from you.
          </p>
        </div>

        {submitStatus === 'error' && (
          <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">
              Something went wrong. Please try again or email us directly at damrec.prod@gmail.com
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-skribble-azure text-sm mb-2 font-medium">
              Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-azure/60" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none transition-colors"
                placeholder="Your full name"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-skribble-azure text-sm mb-2 font-medium">
              Email *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-azure/60" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none transition-colors"
                placeholder="your@email.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-skribble-azure text-sm mb-2 font-medium">
              Subject *
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-azure/60" />
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none transition-colors"
                placeholder="What's this about?"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-skribble-azure text-sm mb-2 font-medium">
              Message *
            </label>
            <textarea
              required
              value={formData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
              rows={5}
              className="w-full px-4 py-3 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none transition-colors resize-vertical"
              placeholder="Tell us more about your inquiry..."
              disabled={isSubmitting}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-skribble-azure to-skribble-sky text-skribble-dark font-semibold rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-skribble-dark/30 border-t-skribble-dark rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Message
              </>
            )}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-skribble-azure/20 text-center">
          <p className="text-skribble-azure/70 text-sm">
            You can also reach us directly at{' '}
            <a
              href="mailto:damrec.prod@gmail.com"
              className="text-skribble-azure hover:text-skribble-sky transition-colors"
            >
              damrec.prod@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
</div>
  );
};

export default ContactForm;