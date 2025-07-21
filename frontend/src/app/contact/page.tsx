// frontend/src/app/contact/page.tsx - Fixed TypeScript Types
"use client";

import React, { useState } from 'react';
import { Mail, User, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// Type definitions for better TypeScript support
interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

type SubmitStatus = 'success' | 'error' | null;

const ContactForm = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(null);

  // Fixed function with proper TypeScript types
  const handleInputChange = (field: keyof FormData, value: string): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
          </nav>
        </header>

        {/* Success Message */}
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-madimi text-3xl text-white mb-4">Message Sent!</h1>
            <p className="text-skribble-azure mb-8">
              Thank you for reaching out. We'll get back to you within 24 hours.
            </p>
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-skribble-azure to-skribble-sky text-skribble-dark px-6 py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300"
            >
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="relative z-50 px-6 py-6">
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
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="/pricing" className="text-skribble-azure hover:text-skribble-sky transition-colors">
              Pricing
            </Link>
            <Link href="/quickstart" className="text-skribble-azure hover:text-skribble-sky transition-colors">
              Quickstart
            </Link>
            <Link href="/contact" className="text-skribble-sky font-medium">
              Contact
            </Link>
            <Link 
              href="/login" 
              className="text-skribble-azure hover:text-skribble-sky transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/register" 
              className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
            <div className="text-center mb-8">
              <h1 className="font-madimi text-4xl text-skribble-sky mb-4">Get in Touch</h1>
              <p className="text-skribble-azure text-lg">
                Have questions about Skribble? Need help with your account? 
                We'd love to hear from you.
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

            <form onSubmit={handleSubmit} className="space-y-6">
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
            </form>

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
      </main>
    </div>
  );
};

export default ContactForm;