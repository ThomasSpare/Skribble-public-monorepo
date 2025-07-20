// frontend/src/app/pricing/page.tsx - Updated with Guest Upgrade Support
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Check, 
  Gift, 
  Star, 
  ArrowRight, 
  Users, 
  Clock, 
  Crown,
  Zap,
  AlertCircle
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  username: string;
  subscriptionTier: string;
  isGuest?: boolean;
  guestExpiresAt?: string;
}

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams?.get('ref') || '';
  const isUpgrade = searchParams?.get('upgrade') === 'guest';
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('skribble_token');
    const userData = localStorage.getItem('skribble_user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  const plans = [
    {
      name: 'Indie',
      tier: 'indie',
      price: '$7',
      period: '/month',
      description: 'Perfect for independent creators',
      features: [
        '5 active projects',
        'Advanced collaboration tools',
        'Up to 2 collaborators per project',
        'Priority support',
        'Export to DAW',
        'Voice notes',
        '50MB file uploads'
      ],
      buttonText: 'Choose Indie',
      popular: false,
      recommended: user?.subscriptionTier === 'artist_guest'
    },
    {
      name: 'Producer',
      tier: 'producer',
      price: '$19',
      period: '/month',
      description: 'For professional producers',
      features: [
        '25 active projects',
        'Team collaboration',
        'Up to 10 collaborators per project',
        '24/7 priority support',
        'Advanced export options',
        'Voice notes & annotations',
        '200MB file uploads',
        'Project templates'
      ],
      buttonText: 'Choose Producer',
      popular: true,
      recommended: false
    },
    {
      name: 'Studio',
      tier: 'studio',
      price: '$49',
      period: '/month',
      description: 'For recording studios and labels',
      features: [
        'Unlimited projects',
        'White-label solution',
        'Unlimited collaborators',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        '1GB file uploads',
        'Advanced analytics'
      ],
      buttonText: 'Contact Sales',
      popular: false,
      recommended: false
    }
  ];

  const handleSelectPlan = async (plan: any) => {
    setSelectedPlan(plan.tier);
    setLoading(plan.tier);

    try {
      const token = localStorage.getItem('skribble_token');
      
      if (!token) {
        // Redirect to register
        const params = new URLSearchParams();
        if (referralCode) params.set('ref', referralCode);
        params.set('plan', plan.tier);
        
        router.push(`/register?${params.toString()}`);
        return;
      }

      // Handle upgrade for existing users (including guests)
      if (user?.subscriptionTier === 'artist_guest') {
        await handleGuestUpgrade(plan.tier);
      } else {
        await handleRegularUpgrade(plan.tier);
      }

    } catch (error: any) {
      console.error('Plan selection error:', error);
      alert(error.message || 'Failed to process plan selection. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleGuestUpgrade = async (tier: string) => {
    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/upgrade-guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tier })
      });

      const data = await response.json();
      
      if (data.success && data.data.paymentUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.data.paymentUrl;
      } else {
        throw new Error(data.error?.message || 'Failed to initiate upgrade');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleRegularUpgrade = async (tier: string) => {
    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tier })
      });

      const data = await response.json();
      
      if (data.success && data.data.paymentUrl) {
        window.location.href = data.data.paymentUrl;
      } else {
        throw new Error(data.error?.message || 'Failed to create checkout session');
      }
    } catch (error) {
      throw error;
    }
  };

  const isCurrentPlan = (tier: string) => {
    return user && user.subscriptionTier === tier;
  };

  const getGuestTimeRemaining = () => {
    if (!user?.guestExpiresAt) return null;
    
    const expiresAt = new Date(user.guestExpiresAt);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const guestDaysRemaining = user?.subscriptionTier === 'artist_guest' ? getGuestTimeRemaining() : null;

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
          
          <div className="text-sm text-skribble-azure">
            {!user ? (
              <>
                Already have an account?{' '}
                <Link href="/login" className="text-skribble-sky hover:text-skribble-azure transition-colors">
                  Sign In
                </Link>
              </>
            ) : (
              <Link href="/dashboard" className="text-skribble-sky hover:text-skribble-azure transition-colors">
                Dashboard
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="px-6 py-12">
        <div className="max-w-7xl mx-auto">
          
          {/* Guest Upgrade Alert */}
          {isUpgrade && user?.subscriptionTier === 'artist_guest' && (
            <div className="max-w-4xl mx-auto mb-12">
              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-2xl p-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="font-madimi text-2xl text-white mb-4">
                    {guestDaysRemaining !== null && guestDaysRemaining <= 1 ? 
                      'Trial Expires Today!' : 
                      `${guestDaysRemaining} Days Left`
                    }
                  </h2>
                  <p className="text-lg text-orange-200 mb-6">
                    Don't lose access to your collaborations. Upgrade now to keep creating!
                  </p>
                  {guestDaysRemaining !== null && guestDaysRemaining <= 3 && (
                    <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 justify-center text-red-300">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">Action Required</span>
                      </div>
                      <p className="text-red-200 text-sm mt-2">
                        Your guest access will be removed when the trial expires
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Referral Banner */}
          {referralCode && (
            <div className="max-w-4xl mx-auto mb-12">
              <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 justify-center">
                  <Gift className="w-6 h-6 text-green-400" />
                  <div className="text-center">
                    <h3 className="text-green-400 font-medium text-lg">Referral Applied!</h3>
                    <p className="text-green-300">
                      Get your first month free when you complete registration
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="font-madimi text-5xl md:text-6xl text-skribble-sky mb-6">
              {isUpgrade ? 'Upgrade Your Account' : 'Choose Your Plan'}
            </h1>
            <p className="text-xl text-skribble-azure max-w-2xl mx-auto mb-8">
              {isUpgrade ? 
                'Continue collaborating and unlock premium features' :
                'Start collaborating on music projects today. All plans include a 14-day free trial.'
              }
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {plans.map((plan, index) => (
              <div 
                key={index} 
                className={`relative bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border transition-all duration-300 hover:transform hover:scale-105 ${
                  plan.popular 
                    ? 'border-skribble-azure shadow-lg shadow-skribble-azure/25' 
                    : plan.recommended
                    ? 'border-green-400 shadow-lg shadow-green-400/25'
                    : 'border-skribble-azure/20 hover:border-skribble-azure/40'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Recommended Badge */}
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Recommended
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="font-madimi text-2xl text-skribble-sky mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-skribble-azure text-sm mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-skribble-azure ml-1">
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-skribble-azure text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Button */}
                {isCurrentPlan(plan.tier) ? (
                  <div className="text-center">
                    <div className="bg-green-500/20 border border-green-500/30 text-green-400 py-3 rounded-lg font-medium">
                      Current Plan
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loading === plan.tier}
                    className={`w-full py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-skribble-azure to-skribble-purple text-white hover:shadow-lg hover:shadow-skribble-azure/25'
                        : plan.recommended
                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:shadow-green-500/25'
                        : 'bg-skribble-dark/50 border border-skribble-azure/30 text-skribble-azure hover:border-skribble-azure/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading === plan.tier ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        {plan.buttonText}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Guest Account Info */}
          {user?.subscriptionTier === 'artist_guest' && (
            <div className="max-w-4xl mx-auto mb-16">
              <div className="bg-skribble-dark/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="font-madimi text-2xl text-white mb-4">
                    You're Currently a Guest
                  </h2>
                  <p className="text-skribble-azure mb-6">
                    As a guest, you can collaborate on projects you're invited to, but you can't create your own projects or invite others.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-skribble-plum/30 rounded-lg p-4">
                      <h3 className="font-medium text-white mb-3">✅ What You Can Do</h3>
                      <ul className="text-sm text-skribble-azure space-y-1 text-left">
                        <li>• Add timestamped comments</li>
                        <li>• Record voice notes</li>
                        <li>• View project history</li>
                        <li>• Collaborate in real-time</li>
                      </ul>
                    </div>
                    <div className="bg-skribble-plum/30 rounded-lg p-4">
                      <h3 className="font-medium text-white mb-3">🔒 Upgrade to Unlock</h3>
                      <ul className="text-sm text-skribble-azure space-y-1 text-left">
                        <li>• Create your own projects</li>
                        <li>• Invite collaborators</li>
                        <li>• Advanced export options</li>
                        <li>• Priority support</li>
                      </ul>
                    </div>
                  </div>

                  {guestDaysRemaining !== null && (
                    <div className={`rounded-lg p-4 mb-6 ${
                      guestDaysRemaining <= 3 ? 
                        'bg-red-500/20 border border-red-500/30' :
                        'bg-blue-500/20 border border-blue-500/30'
                    }`}>
                      <p className={`font-medium ${
                        guestDaysRemaining <= 3 ? 'text-red-300' : 'text-blue-300'
                      }`}>
                        {guestDaysRemaining === 0 ? 
                          'Your trial expires today!' :
                          guestDaysRemaining === 1 ?
                          'Your trial expires tomorrow!' :
                          `${guestDaysRemaining} days remaining in your free trial`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FAQ Section */}
          <div className="max-w-4xl mx-auto">
            <h2 className="font-madimi text-3xl text-white text-center mb-12">
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-6">
              <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20">
                <h3 className="font-medium text-white mb-3">
                  What happens to guest accounts after 30 days?
                </h3>
                <p className="text-skribble-azure">
                  Guest accounts automatically expire after 30 days. To continue collaborating, you'll need to upgrade to a paid plan. Your collaboration history and comments will be preserved when you upgrade.
                </p>
              </div>

              <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20">
                <h3 className="font-medium text-white mb-3">
                  Can I switch plans anytime?
                </h3>
                <p className="text-skribble-azure">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing differences.
                </p>
              </div>

              <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20">
                <h3 className="font-medium text-white mb-3">
                  Do you offer discounts for students or teams?
                </h3>
                <p className="text-skribble-azure">
                  We offer educational discounts for verified students and bulk pricing for teams. Contact our sales team for custom pricing options.
                </p>
              </div>

              <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20">
                <h3 className="font-medium text-white mb-3">
                  What file formats do you support?
                </h3>
                <p className="text-skribble-azure">
                  We support all major audio formats including MP3, WAV, AIFF, FLAC, and M4A. File size limits vary by plan, from 50MB on Indie to 1GB on Studio plans.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}