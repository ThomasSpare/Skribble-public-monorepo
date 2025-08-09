'use client'

import { useEffect } from 'react'

export default function Analytics({ path }: { path?: string }) {
  useEffect(() => {
    const trackPageView = async () => {
      try {
        // Skip tracking in development mode or if explicitly disabled
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 Analytics tracking disabled in development mode');
          return;
        }

        // Generate or retrieve session ID
        const sessionId = localStorage.getItem('analytics_session') || generateSessionId();
        
        // Get screen resolution
        const screenResolution = `${window.screen.width}x${window.screen.height}`;
        
        // Get API URL from environment or default to current origin
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
        
        const response = await fetch(`${apiUrl}/api/analytics/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: path || window.location.pathname,
            referrer: document.referrer || undefined,
            sessionId,
            screenResolution,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.sessionId) {
          // Store the session ID for future requests
          localStorage.setItem('analytics_session', data.sessionId);
          
          if (process.env.NODE_ENV === 'development') {
            console.log('📊 Analytics tracked:', {
              path: path || window.location.pathname,
              sessionId: data.sessionId,
              referrer: document.referrer,
              screenResolution
            });
          }
        } else {
          console.warn('📊 Analytics tracking failed:', data);
        }
      } catch (error) {
        // Fail silently in production to avoid disrupting user experience
        if (process.env.NODE_ENV === 'development') {
          console.error('📊 Analytics tracking error:', error);
        }
      }
    };

    // Track page view with a small delay to ensure page is loaded
    const timeoutId = setTimeout(trackPageView, 100);

    return () => clearTimeout(timeoutId);
  }, [path]);

  // This component renders nothing
  return null;
}

function generateSessionId(): string {
  // Generate a unique session ID
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}