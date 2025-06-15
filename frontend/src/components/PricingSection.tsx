// frontend/src/components/PricingSection.tsx
import { useState, useEffect } from 'react';
import { Check, Users, Star, Gift, Clock } from 'lucide-react';

interface PricingPlan {
  name: string;
  price: string;
  originalPrice?: string;
  description: string;
  features: string[];
  popular: boolean;
  priceId: string;
  tier: 'indie' | 'producer' | 'studio';
  trialDays?: number;
}

const plans: PricingPlan[] = [
  {
    name: "Indie",
    price: "$7",
    description: "Perfect for solo producers",
    features: ["5 active projects", "2 collaborators", "50MB files", "Basic exports", "Email support"],
    popular: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_INDIE_MONTHLY || "price_indie_monthly",
    tier: "indie",
    trialDays: 30
  },
  {
    name: "Producer",
    price: "$19",
    description: "For serious professionals",
    features: ["25 projects", "10 collaborators", "200MB files", "All export formats", "Voice notes", "Priority support", "Advanced analytics"],
    popular: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRODUCER_MONTHLY || "price_producer_monthly",
    tier: "producer",
    trialDays: 30
  },
  {
    name: "Studio",
    price: "$49",
    description: "For teams and labels",
    features: ["Unlimited projects", "Unlimited collaborators", "1GB files", "White-label options", "Advanced analytics", "24/7 support", "API access"],
    popular: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_MONTHLY || "price_studio_monthly",
    tier: "studio",
    trialDays: 30
  }
];

export default function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [validReferral, setValidReferral] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      validateReferralCode(refCode);
    }

    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserData(token);
    }
  }, []);

  const fetchUserData = async (token: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setValidReferral(null);
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/validate-referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: code })
      });
      
      const data = await response.json();
      setValidReferral(data.success);
    } catch (error) {
      setValidReferral(false);
    }
  };

  const handleSubscribe = async (plan: PricingPlan) => {
    setLoading(plan.tier);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Store plan selection and redirect to login
        localStorage.setItem('selectedPlan', JSON.stringify(plan));
        localStorage.setItem('referralCode', referralCode);
        window.location.href = '/login?redirect=pricing';
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          referralCode: referralCode || undefined
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Redirect to Stripe Checkout
        window.location.href = data.data.url;
      } else {
        throw new Error(data.error.message);
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      alert('Failed to start subscription. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const startFreeTrial = async () => {
    setLoading('trial');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        localStorage.setItem('pendingAction', 'startTrial');
        window.location.href = '/login?redirect=pricing';
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/start-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Free trial started! Redirecting to dashboard...');
        window.location.href = '/dashboard';
      } else {
        throw new Error(data.error.message);
      }
    } catch (error: any) {
      console.error('Trial start error:', error);
      alert(error.message || 'Failed to start trial. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const isCurrentPlan = (tier: string) => {
    return user && user.subscriptionTier === tier;
  };

  const canStartTrial = () => {
    return user && !user.trial_used && user.subscriptionTier === 'free';
  };

  return (
    <section id="pricing" className="px-6 py-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-madimi text-4xl md:text-5xl text-skribble-sky mb-6">
            Simple Pricing
          </h2>
          <p className="text-lg text-skribble-azure max-w-2xl mx-auto mb-8">
            Choose the plan that fits your collaboration needs. Start with a free 30-day trial!
          </p>
          
          {/* Free Trial CTA - Only show if user can start trial */}
          {(!user || canStartTrial()) && (
            <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-2xl p-6 mb-8 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-white" />
                <h3 className="text-white font-madimi text-xl">30-Day Free Trial</h3>
                <Clock className="w-5 h-5 text-white" />
              </div>
              <p className="text-white/90 mb-4">
                Try all Indie features free for 30 days. No credit card required.
              </p>
              <button 
                onClick={startFreeTrial}
                disabled={loading === 'trial'}
                className="bg-white text-skribble-purple px-6 py-2 rounded-full font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {loading === 'trial' ? 'Starting...' : 'Start Free Trial'}
              </button>
            </div>
          )}

          {/* Referral Code Input */}
          <div className="max-w-sm mx-auto mb-8">
            <label className="block text-skribble-azure text-sm mb-2">
              Have a referral code? Get your first month free!
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralCode}
                onChange={(e) => {
                  setReferralCode(e.target.value);
                  validateReferralCode(e.target.value);
                }}
                placeholder="Enter referral code"
                className="flex-1 px-3 py-2 bg-skribble-dark border border-skribble-azure/20 rounded-lg text-skribble-sky placeholder-skribble-azure/50"
              />
              {validReferral === true && (
                <div className="flex items-center text-green-400">
                  <Gift className="w-5 h-5" />
                </div>
              )}
              {validReferral === false && (
                <div className="flex items-center text-red-400">
                  <span className="text-sm">Invalid</span>
                </div>
              )}
            </div>
            {validReferral === true && (
              <p className="text-green-400 text-sm mt-1">
                Valid referral! You'll get your first month free.
              </p>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`relative bg-skribble-dark border-2 rounded-2xl p-8 transition-all duration-300 hover:scale-105 ${
                plan.popular
                  ? 'border-skribble-azure shadow-lg shadow-skribble-azure/20'
                  : 'border-skribble-azure/20 hover:border-skribble-azure/40'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="font-madimi text-2xl text-skribble-sky mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-4xl font-bold text-skribble-azure">
                    {plan.price}
                  </span>
                  <span className="text-skribble-azure/70">/month</span>
                </div>
                {plan.trialDays && (
                  <p className="text-skribble-purple text-sm">
                    {plan.trialDays}-day free trial
                  </p>
                )}
                <p className="text-skribble-azure/80 text-sm mt-2">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-skribble-azure">
                    <Check className="w-5 h-5 text-green-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.tier || isCurrentPlan(plan.tier)}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 ${
                  isCurrentPlan(plan.tier)
                    ? 'bg-skribble-azure/20 text-skribble-azure cursor-not-allowed'
                    : plan.popular
                    ? 'bg-gradient-to-r from-skribble-azure to-skribble-purple text-white hover:shadow-lg hover:shadow-skribble-azure/30'
                    : 'border-2 border-skribble-azure text-skribble-azure hover:bg-skribble-azure hover:text-skribble-dark'
                } disabled:opacity-50`}
              >
                {loading === plan.tier ? (
                  'Processing...'
                ) : isCurrentPlan(plan.tier) ? (
                  'Current Plan'
                ) : (
                  `Choose ${plan.name}`
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Features Comparison */}
        <div className="text-center">
          <h3 className="font-madimi text-2xl text-skribble-sky mb-8">
            Why Choose Skribble?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-skribble-azure/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-skribble-azure" />
              </div>
              <h4 className="font-medium text-skribble-sky mb-2">Real-time Collaboration</h4>
              <p className="text-skribble-azure/80 text-sm">
                Get instant feedback from artists with timestamped annotations and voice notes.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-skribble-azure/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-skribble-azure" />
              </div>
              <h4 className="font-medium text-skribble-sky mb-2">DAW Integration</h4>
              <p className="text-skribble-azure/80 text-sm">
                Export annotations directly to your favorite DAW with precision timing.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-skribble-azure/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-skribble-azure" />
              </div>
              <h4 className="font-medium text-skribble-sky mb-2">Referral Rewards</h4>
              <p className="text-skribble-azure/80 text-sm">
                Refer friends and both get a free month. Build your network and save money.
              </p>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="mt-16 text-center">
          <blockquote className="text-xl text-skribble-azure italic mb-4">
            "The best thing about Skribble is how it bridges the gap between producers and artists. 
            No more endless email chains or confusing feedback."
          </blockquote>
          <p className="text-skribble-sky font-medium">— Max Martin, Grammy-winning Producer</p>
        </div>
      </div>
    </section>
  );
}