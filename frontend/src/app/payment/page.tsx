// frontend/src/app/payment/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  CreditCard, 
  Check, 
  Loader2, 
  ArrowLeft, 
  Shield, 
  Gift, 
  Crown,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface PlanDetails {
  name: string;
  price: string;
  priceId: string;
  features: string[];
  tier: 'indie' | 'producer' | 'studio';
}

const planDetails: Record<string, PlanDetails> = {
  indie: {
    name: 'Indie',
    price: '$7',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_INDIE_MONTHLY || 'price_1RX81LP1MO6JhWIjvS8HlwHR',
    tier: 'indie',
    features: [
      '5 active projects',
      'Advanced collaboration tools',
      'Up to 2 collaborators',
      'Priority support',
      'Export to DAW',
      'Voice notes'
    ]
  },
  producer: {
    name: 'Producer',
    price: '$19',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRODUCER_MONTHLY || 'price_1RX829P1MO6JhWIjrqgwrWDr',
    tier: 'producer',
    features: [
      '20 projects',
      'Team collaboration',
      '24/7 priority support',
      'Advanced export options',
    ]
  },
  studio: {
    name: 'Studio',
    price: '$49',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_MONTHLY || 'price_1RX82xP1MO6JhWIj1En2CPda',
    tier: 'studio',
    features: [
      'Unlimited projects',
      'White-label solution',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee'
    ]
  }
};

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const planTier = (searchParams?.get('plan') as 'indie' | 'producer' | 'studio') || 'producer';
  const referralCode = searchParams?.get('ref') || '';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const plan = planDetails[planTier];

  useEffect(() => {
    // Get user info to verify they're logged in
    const token = localStorage.getItem('skribble_token') || localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=payment');
      return;
    }

    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('skribble_token') || localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setUser(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('skribble_token') || localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      // Create Stripe checkout session
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          tier: plan.tier,
          referralCode: referralCode || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to Stripe Checkout
        if (data.data.checkoutUrl) {
          window.location.href = data.data.checkoutUrl;
        } else {
          // Fallback
          router.push('/dashboard');
        }
      } else {
        setError(data.error?.message || 'Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFreeTrial = async () => {
    // For now, just redirect to dashboard since user is already registered
    // In a real implementation, you might want to set up a trial period
    router.push('/dashboard?trial=started');
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl text-skribble-sky mb-2">Invalid Plan</h1>
          <Link href="/pricing" className="text-skribble-azure hover:text-skribble-sky">
            Choose a valid plan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="relative z-50 px-6 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/register" className="flex items-center gap-3 text-skribble-sky hover:text-skribble-azure transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          
          <div className="relative">
            <h1 className="font-madimi text-2xl text-skribble-sky">Skribble</h1>
            <div className="absolute -top-2 -right-3 bg-skribble-azure rounded-lg rounded-bl-sm px-1.5 py-0.5">
              <div className="flex items-center gap-0.5">
                <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-madimi text-4xl md:text-5xl text-skribble-sky mb-4">
              Complete Your Registration
            </h1>
            <p className="text-xl text-skribble-azure">
              You're one step away from joining Skribble!
            </p>
          </div>

          {/* Referral Banner */}
          {referralCode && (
            <div className="mb-8 bg-green-500/20 border border-green-500/30 rounded-2xl p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Gift className="w-6 h-6 text-green-400" />
                <h3 className="text-xl font-madimi text-green-400">Referral Discount Applied!</h3>
              </div>
              <p className="text-green-300">
                Your first month is <strong>FREE</strong> thanks to your friend's referral!
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Plan Details */}
            <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
              <div className="flex items-center gap-3 mb-6">
                <Crown className="w-6 h-6 text-skribble-azure" />
                <h2 className="font-madimi text-2xl text-skribble-sky">Your Plan</h2>
              </div>

              <div className="text-center mb-8">
                <h3 className="font-madimi text-3xl text-skribble-sky mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-skribble-azure">{plan.price}</span>
                  <span className="text-skribble-purple">/month</span>
                </div>
                
                {referralCode ? (
                  <div className="bg-green-500/20 rounded-lg p-3 mb-4">
                    <p className="text-green-400 text-sm font-medium">
                      First month FREE with referral code!
                    </p>
                    <p className="text-green-300 text-xs">
                      Then {plan.price}/month after trial
                    </p>
                  </div>
                ) : (
                  <div className="bg-skribble-azure/20 rounded-lg p-3 mb-4">
                    <p className="text-skribble-azure text-sm font-medium">
                      14-day free trial included
                    </p>
                    <p className="text-skribble-sky text-xs">
                      Cancel anytime during trial
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-skribble-sky mb-4">What's included:</h4>
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-skribble-azure flex-shrink-0" />
                    <span className="text-skribble-sky">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Section */}
            <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
              <div className="flex items-center gap-3 mb-6">
                <CreditCard className="w-6 h-6 text-skribble-azure" />
                <h2 className="font-madimi text-2xl text-skribble-sky">Payment</h2>
              </div>

              {error && (
                <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {user && (
                <div className="mb-6 p-4 bg-skribble-dark/50 rounded-lg">
                  <p className="text-skribble-azure text-sm mb-1">Account:</p>
                  <p className="text-skribble-sky font-medium">{user.email}</p>
                  <p className="text-skribble-azure text-sm">@{user.username}</p>
                </div>
              )}

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-skribble-azure text-sm">
                  <Shield className="w-4 h-4" />
                  <span>Secure payment powered by Stripe</span>
                </div>
                <div className="flex items-center gap-3 text-skribble-azure text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>Cancel anytime, no commitment</span>
                </div>
                <div className="flex items-center gap-3 text-skribble-azure text-sm">
                  <Check className="w-4 h-4" />
                  <span>Start collaborating immediately</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Start Free Trial Button */}
                <button
                  onClick={handleFreeTrial}
                  className="w-full bg-skribble-azure/20 border border-skribble-azure text-skribble-azure py-3 rounded-lg font-medium hover:bg-skribble-azure hover:text-white transition-all duration-300"
                >
                  <Calendar className="w-5 h-5 inline mr-2" />
                  Start 14-Day Free Trial
                </button>

                <div className="text-center text-skribble-azure text-sm">
                  or
                </div>

                {/* Pay Now Button */}
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-skribble-azure to-skribble-purple text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      {referralCode ? 'Start Free Month' : `Pay ${plan.price}/month`}
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-skribble-azure text-xs mt-6">
                By continuing, you agree to our{' '}
                <Link href="/terms" className="text-skribble-sky hover:text-skribble-azure transition-colors">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-skribble-sky hover:text-skribble-azure transition-colors">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-skribble-plum/20 rounded-lg p-6">
              <Shield className="w-8 h-8 text-skribble-azure mx-auto mb-3" />
              <h3 className="font-medium text-skribble-sky mb-2">Secure & Private</h3>
              <p className="text-skribble-azure text-sm">Your music and data are protected with enterprise-grade security.</p>
            </div>
            <div className="bg-skribble-plum/20 rounded-lg p-6">
              <Calendar className="w-8 h-8 text-skribble-azure mx-auto mb-3" />
              <h3 className="font-medium text-skribble-sky mb-2">No Commitment</h3>
              <p className="text-skribble-azure text-sm">Cancel your subscription anytime with no questions asked.</p>
            </div>
            <div className="bg-skribble-plum/20 rounded-lg p-6">
              <Check className="w-8 h-8 text-skribble-azure mx-auto mb-3" />
              <h3 className="font-medium text-skribble-sky mb-2">Instant Access</h3>
              <p className="text-skribble-azure text-sm">Start collaborating on music projects immediately after signup.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}