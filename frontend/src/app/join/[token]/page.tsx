// frontend/src/app/join/[token]/page.tsx - GUEST ACCESS VERSION
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle, Gift, UserPlus, Mail } from 'lucide-react';

interface GuestJoinResponse {
  success: boolean;
  data?: {
    message: string;
    projectId: string;
    role: string;
    guestUser: {
      id: string;
      email: string;
      username: string;
      temporaryAccess: boolean;
      trialEndDate: string;
    };
    token: string;
    projectInfo: {
      title: string;
      creatorName: string;
    };
  };
  error?: {
    message: string;
    code: string;
  };
}

interface GuestRegistrationData {
  email: string;
  username: string;
  inviteToken: string;
}

export default function GuestJoinPage() {
  const router = useRouter();
  const params = useParams();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [needsRegistration, setNeedsRegistration] = useState<boolean>(false);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  
  // Guest registration form
  const [guestData, setGuestData] = useState<GuestRegistrationData>({
    email: '',
    username: '',
    inviteToken: params.token as string
  });

  useEffect(() => {
    attemptGuestJoin();
  }, [params.token]);

  const attemptGuestJoin = async () => {
    try {
      setIsLoading(true);
      
      // First, try to get invite info (public endpoint that doesn't require auth)
      const inviteInfoResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/collaboration/invite-info/${params.token}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (inviteInfoResponse.ok) {
        const inviteInfo = await inviteInfoResponse.json();
        if (inviteInfo.success) {
          setProjectInfo(inviteInfo.data);
        }
      }

      // Check if user is already logged in
      const existingToken = localStorage.getItem('skribble_token') || localStorage.getItem('token');
      
      if (existingToken) {
        // User is logged in, try to join normally
        await joinWithExistingAuth(existingToken);
      } else {
        // No existing auth, show guest registration form
        setNeedsRegistration(true);
        setIsLoading(false);
      }

    } catch (error) {
      console.error('Error in attemptGuestJoin:', error);
      setError('Failed to process invitation');
      setIsLoading(false);
    }
  };

  const joinWithExistingAuth = async (token: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/collaboration/join/${params.token}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Guest-Invite': 'true'
          }
        }
      );

      const data: GuestJoinResponse = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/project/${data.data?.projectId}`);
        }, 2000);
      } else {
        if (response.status === 401) {
          // Token expired, clear it and show registration
          localStorage.removeItem('skribble_token');
          localStorage.removeItem('token');
          setNeedsRegistration(true);
        } else {
          setError(data.error?.message || 'Failed to join project');
        }
      }
    } catch (error) {
      console.error('Error joining with existing auth:', error);
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Create guest account and join project in one call
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/collaboration/guest-join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(guestData)
        }
      );

      const data: GuestJoinResponse = await response.json();

      if (data.success && data.data) {
        // Store the auth token
        localStorage.setItem('skribble_token', data.data.token);
        
        setSuccess(true);
        
        // Show success message with trial info
        setTimeout(() => {
          router.push(`/project/${data.data?.projectId}`);
        }, 2000);
      } else {
        setError(data.error?.message || 'Failed to create guest account');
      }
    } catch (error) {
      console.error('Guest registration error:', error);
      setError('Network error during guest registration');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !needsRegistration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-900 via-purple-900 to-black">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Processing Invitation...</h2>
          <p className="text-blue-200">Setting up your guest access</p>
        </div>
      </div>
    );
  }

  if (needsRegistration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-900 via-purple-900 to-black">
        <div className="w-full max-w-md">
          {/* Project Info Banner */}
          {projectInfo && (
            <div className="mb-6 p-4 bg-blue-600/20 border border-blue-400/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-5 h-5 text-blue-300" />
                <h3 className="text-blue-200 font-medium">You're Invited!</h3>
              </div>
              <p className="text-blue-100 text-sm">
                <strong>{projectInfo.creatorName}</strong> invited you to collaborate on{' '}
                <strong>"{projectInfo.title}"</strong>
              </p>
            </div>
          )}

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <UserPlus className="w-12 h-12 text-blue-300 mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-white mb-2">Get Free 30-Day Access</h1>
              <p className="text-blue-200 text-sm">
                No payment required • Join instantly • Full collaboration features
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-600/20 border border-red-400/30 rounded-lg">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleGuestRegistration} className="space-y-4">
              <div>
                <label className="block text-blue-100 text-sm font-medium mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-300" />
                  <input
                    type="email"
                    required
                    value={guestData.email}
                    onChange={(e) => setGuestData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:border-blue-400 focus:outline-none"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-blue-100 text-sm font-medium mb-2">Username</label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-300" />
                  <input
                    type="text"
                    required
                    value={guestData.username}
                    onChange={(e) => setGuestData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:border-blue-400 focus:outline-none"
                    placeholder="Choose a username"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    Start Free Trial & Join Project
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-blue-200 text-xs">
                By joining, you get 30 days of free access to collaborate on this project
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-red-900 via-gray-900 to-black">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Invitation Error</h2>
          <p className="text-red-200 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-green-900 via-blue-900 to-purple-900">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Welcome to the Project!</h2>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Gift className="w-6 h-6 text-blue-300" />
            <p className="text-blue-200 text-lg">30-day free trial activated</p>
          </div>
          <p className="text-gray-300 mb-6">You now have full access to collaborate on this project</p>
          <div className="animate-pulse text-blue-200">Redirecting to project...</div>
        </div>
      </div>
    );
  }

  return null;
}