// frontend/src/app/success/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2, Music, Users, Crown, ArrowRight } from 'lucide-react';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      setError('No session ID found');
      setLoading(false);
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/stripe/checkout-session/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setSessionData(data.data);
        if (data.data.status === 'paid') {
          setSuccess(true);
          
          // Call the success endpoint to update user subscription
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/stripe/checkout-success`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: sessionId
            })
          });
        } else {
          setError('Payment was not completed');
        }
      } else {
        setError('Failed to verify payment');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setError('Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    // Redirect to dashboard
    router.push('/dashboard?welcome=true');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20 text-center max-w-md mx-auto">
          <Loader2 className="w-12 h-12 text-skribble-azure animate-spin mx-auto mb-4" />
          <h2 className="font-madimi text-xl text-skribble-sky mb-2">
            Verifying your payment...
          </h2>
          <p className="text-skribble-azure">
            Please wait while we confirm your subscription.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-red-500/20 text-center max-w-md mx-auto">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">⚠️</span>
          </div>
          <h2 className="font-madimi text-xl text-skribble-sky mb-2">
            Payment Verification Failed
          </h2>
          <p className="text-red-400 mb-6">{error}</p>
          <div className="space-y-3">
            <Link 
              href="/payment"
              className="block w-full bg-skribble-azure text-white py-2 rounded-lg hover:bg-skribble-azure/80 transition-colors"
            >
              Try Again
            </Link>
            <Link 
              href="/dashboard"
              className="block w-full border border-skribble-azure text-skribble-azure py-2 rounded-lg hover:bg-skribble-azure hover:text-white transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      <div className="container mx-auto px-6 py-12 flex items-center justify-center min-h-screen">
        <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20 text-center max-w-2xl mx-auto">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-green-400" />
          </div>

          {/* Success Message */}
          <h1 className="font-madimi text-3xl md:text-4xl text-skribble-sky mb-4">
            Welcome to Skribble!
          </h1>
          
          <p className="text-xl text-skribble-azure mb-2">
            Your payment was successful 🎉
          </p>
          
          {sessionData?.customerEmail && (
            <p className="text-skribble-azure mb-8">
              Confirmation sent to <strong>{sessionData.customerEmail}</strong>
            </p>
          )}

          {/* Plan Info */}
          {sessionData?.metadata?.tier && (
            <div className="bg-skribble-dark/50 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Crown className="w-6 h-6 text-skribble-azure" />
                <h3 className="font-madimi text-xl text-skribble-sky">
                  {sessionData.metadata.tier.charAt(0).toUpperCase() + sessionData.metadata.tier.slice(1)} Plan Activated
                </h3>
              </div>
              
              {sessionData.metadata.referralCode && (
                <div className="bg-green-500/20 rounded-lg p-3 mb-4">
                  <p className="text-green-400 text-sm">
                    🎁 Referral bonus applied - enjoy your free month!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* What's Next */}
          <div className="text-left mb-8">
            <h3 className="font-madimi text-lg text-skribble-sky mb-4 text-center">
              What's next?
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Music className="w-5 h-5 text-skribble-azure mt-1 flex-shrink-0" />
                <div>
                  <h4 className="text-skribble-sky font-medium">Upload your first project</h4>
                  <p className="text-skribble-azure text-sm">
                    Start by uploading an audio file to begin collaborating
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-skribble-azure mt-1 flex-shrink-0" />
                <div>
                  <h4 className="text-skribble-sky font-medium">Invite collaborators</h4>
                  <p className="text-skribble-azure text-sm">
                    Share your projects with artists and get real-time feedback
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-skribble-azure mt-1 flex-shrink-0" />
                <div>
                  <h4 className="text-skribble-sky font-medium">Export to your DAW</h4>
                  <p className="text-skribble-azure text-sm">
                    Download projects with timestamps and annotations
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-skribble-azure to-skribble-purple text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 mb-4"
          >
            Continue to Dashboard
            <ArrowRight className="w-5 h-5" />
          </button>

          <p className="text-skribble-azure text-sm">
            Need help getting started?{' '}
            <Link href="/docs" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Check out our documentation
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}