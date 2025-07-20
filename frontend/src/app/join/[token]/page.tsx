// frontend/src/app/join/[token]/page.tsx - Guest Account Support
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Music, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Mail,
  Loader2,
  Gift
} from 'lucide-react';

interface InviteData {
  projectTitle: string;
  inviterName: string;
  role: string;
  expiresAt: string;
  allowsGuestAccess: boolean;
}

export default function JoinProjectPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinMethod, setJoinMethod] = useState<'guest' | 'signin' | null>(null);

  // Guest account form
  const [guestForm, setGuestForm] = useState({
    name: '',
    email: ''
  });

  useEffect(() => {
    if (token) {
      fetchInviteInfo();
    }
  }, [token]);

  const fetchInviteInfo = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/invite-info/${token}`);
      const data = await response.json();

      if (data.success) {
        setInviteData(data.data);
      } else {
        setError(data.error?.message || 'Invalid invite link');
      }
    } catch (err) {
      setError('Failed to load invite information');
    } finally {
      setLoading(false);
    }
  };

  const joinAsGuest = async () => {
    if (!guestForm.name.trim() || !guestForm.email.trim()) {
      setError('Please provide both name and email');
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/join/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          createGuestAccount: true,
          guestName: guestForm.name.trim(),
          guestEmail: guestForm.email.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        // Store guest token
        localStorage.setItem('skribble_token', data.data.token);
        localStorage.setItem('skribble_user', JSON.stringify(data.data.user));
        
        // Redirect to project
        router.push(`/projects/${data.data.projectId}?welcome=guest`);
      } else {
        if (data.error?.requiresSignIn) {
          setError(data.error.message);
          setJoinMethod('signin');
        } else {
          setError(data.error?.message || 'Failed to join project');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setJoining(false);
    }
  };

  const redirectToSignIn = () => {
    router.push(`/login?redirect=${encodeURIComponent(`/join/${token}`)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-skribble-azure animate-spin mx-auto mb-4" />
          <p className="text-skribble-azure">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-madimi text-white mb-4">Invalid Invite</h1>
          <p className="text-skribble-azure mb-6">{error}</p>
          <Link 
            href="/" 
            className="text-skribble-sky hover:text-skribble-azure transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="px-6 py-6">
        <nav className="max-w-4xl mx-auto">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-skribble-azure hover:text-skribble-sky transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="px-6 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Invite Info Card */}
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20 mb-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-white" />
              </div>
              <h1 className="font-madimi text-3xl text-skribble-sky mb-2">
                You're Invited!
              </h1>
              <p className="text-skribble-azure">
                <strong>{inviteData?.inviterName}</strong> invited you to collaborate on
              </p>
              <h2 className="text-2xl font-madimi text-white mt-2">
                "{inviteData?.projectTitle}"
              </h2>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-skribble-azure mb-8">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Role: {inviteData?.role}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Expires: {inviteData?.expiresAt ? new Date(inviteData.expiresAt).toLocaleDateString() : 'Soon'}</span>
              </div>
            </div>

            {/* Join Options */}
            {!joinMethod && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white text-center mb-6">
                  How would you like to join?
                </h3>

                {/* Guest Account Option */}
                {inviteData?.allowsGuestAccess && (
                  <button
                    onClick={() => setJoinMethod('guest')}
                    className="w-full bg-gradient-to-r from-skribble-azure to-skribble-purple text-white p-6 rounded-xl hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <Gift className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-medium text-lg">Start Free (Recommended)</h4>
                        <p className="text-white/80 text-sm">
                          No account needed • Collaborate for 30 days free • Upgrade anytime
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {/* Sign In Option */}
                <button
                  onClick={() => setJoinMethod('signin')}
                  className="w-full bg-skribble-dark/50 border border-skribble-azure/30 text-skribble-azure p-6 rounded-xl hover:border-skribble-azure/50 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-skribble-azure/20 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-lg text-white">I have an account</h4>
                      <p className="text-skribble-azure text-sm">
                        Sign in to your existing Skribble account
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Guest Account Form */}
            {joinMethod === 'guest' && inviteData?.allowsGuestAccess && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-medium text-white mb-2">
                    Create Free Guest Account
                  </h3>
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 justify-center text-green-400 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">30 Days Free</span>
                    </div>
                    <p className="text-green-300 text-sm">
                      Collaborate on this project for 30 days. Upgrade to continue or access more features.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-skribble-azure mb-2">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-azure/50" />
                      <input
                        type="text"
                        value={guestForm.name}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-skribble-dark/50 border border-skribble-azure/30 rounded-lg pl-10 pr-4 py-3 text-white placeholder-skribble-azure/50 focus:border-skribble-azure focus:outline-none"
                        placeholder="Enter your name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-skribble-azure mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-azure/50" />
                      <input
                        type="email"
                        value={guestForm.email}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-skribble-dark/50 border border-skribble-azure/30 rounded-lg pl-10 pr-4 py-3 text-white placeholder-skribble-azure/50 focus:border-skribble-azure focus:outline-none"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setJoinMethod(null)}
                    className="flex-1 bg-skribble-dark/50 border border-skribble-azure/30 text-skribble-azure py-3 rounded-lg hover:border-skribble-azure/50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={joinAsGuest}
                    disabled={joining || !guestForm.name.trim() || !guestForm.email.trim()}
                    className="flex-1 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white py-3 rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Project'
                    )}
                  </button>
                </div>

                <p className="text-xs text-skribble-azure/70 text-center">
                  By joining, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            )}

            {/* Sign In Redirect */}
            {joinMethod === 'signin' && (
              <div className="text-center space-y-4">
                <h3 className="text-xl font-medium text-white mb-4">
                  Sign In to Your Account
                </h3>
                <p className="text-skribble-azure mb-6">
                  You'll be redirected to sign in, then brought back to join this project.
                </p>
                
                {error && (
                  <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                    <p className="text-yellow-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setJoinMethod(null)}
                    className="flex-1 bg-skribble-dark/50 border border-skribble-azure/30 text-skribble-azure py-3 rounded-lg hover:border-skribble-azure/50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={redirectToSignIn}
                    className="flex-1 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white py-3 rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Benefits Section */}
          <div className="bg-skribble-dark/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/10">
            <h3 className="font-medium text-white mb-4 text-center">
              What you can do as a collaborator:
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Listen & Annotate</p>
                  <p className="text-skribble-azure">Add timestamped comments at exact moments</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Voice Notes</p>
                  <p className="text-skribble-azure">Record audio feedback directly</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Real-time Sync</p>
                  <p className="text-skribble-azure">See updates instantly</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Track Progress</p>
                  <p className="text-skribble-azure">Monitor feedback resolution</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}