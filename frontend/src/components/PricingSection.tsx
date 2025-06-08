// frontend/src/components/PricingSection.tsx
import { useState } from 'react';
import { Check, Users, Star } from 'lucide-react';

interface PricingPlan {
  name: string;
  price: string;
  description: string;
  features: string[];
  popular: boolean;
  priceId: string;
  tier: 'indie' | 'producer' | 'studio';
}

const plans: PricingPlan[] = [
  {
    name: "Indie",
    price: "$7",
    description: "Perfect for solo producers",
    features: ["5 active projects", "2 collaborators", "50MB files", "Basic exports"],
    popular: false,
    priceId: "price_indie_monthly", // Replace with actual Stripe price ID
    tier: "indie"
  },
  {
    name: "Producer",
    price: "$19",
    description: "For serious professionals",
    features: ["25 projects", "10 collaborators", "200MB files", "All export formats", "Voice notes", "Priority support"],
    popular: true,
    priceId: "price_producer_monthly",
    tier: "producer"
  },
  {
    name: "Studio",
    price: "$49",
    description: "For teams and labels",
    features: ["Unlimited projects", "Unlimited collaborators", "1GB files", "White-label options", "Advanced analytics", "24/7 support"],
    popular: false,
    priceId: "price_studio_monthly",
    tier: "studio"
  }
];

export default function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');

  const handleSubscribe = async (plan: PricingPlan) => {
    setLoading(plan.tier);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Redirect to login
        window.location.href = '/login?redirect=pricing';
        return;
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
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
        window.location.href = '/login?redirect=pricing';
        return;
      }

      const response = await fetch('/api/stripe/start-trial', {
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
      alert('Failed to start trial. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="pricing" className="px-6 py-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-madimi text-4xl md:text-5xl text-skribble-sky mb-6">
            Simple Pricing
          </h2>
          <p className="text-lg text-skribble-azure max-w-2xl mx-auto mb-8">
            Choose the plan that fits your collaboration needs. Start with a free 7-day trial!
          </p>
          
          {/* Free Trial CTA */}
          <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-2xl p-6 mb-8 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Star className="w-5 h-5 text-white" />
              <h3 className="text-white font-madimi text-xl">Start Free Trial</h3>
              <Star className="w-5 h-5 text-white" />
            </div>
            <p className="text-white/90 mb-4">
              Try all Indie features free for 7 days. No credit card required.
            </p>
            <button 
              onClick={startFreeTrial}
              disabled={loading === 'trial'}
              className="bg-white text-skribble-purple px-6 py-2 rounded-full font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading === 'trial' ? 'Starting...' : 'Start Free Trial'}
            </button>
          </div>

          {/* Referral Code Input */}
          <div className="max-w-sm mx-auto mb-8">
            <label className="block text-skribble-azure text-sm mb-2">
              Have a referral code? Get your first month free!
            </label>
            <input
              type="text"
              placeholder="Enter referral code"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-skribble-plum/30 border border-skribble-azure/20 text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
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

              <button 
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.tier}
                className={`w-full py-3 rounded-full font-medium transition-all duration-300 disabled:opacity-50 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-skribble-azure to-skribble-purple text-white hover:shadow-lg hover:shadow-skribble-azure/25 hover:scale-105'
                    : 'border border-skribble-azure text-skribble-azure hover:bg-skribble-azure hover:text-white'
                }`}
              >
                {loading === plan.tier ? 'Processing...' : 'Get Started'}
              </button>
            </div>
          ))}
        </div>

        {/* Referral Info */}
        <div className="text-center mt-16">
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-6 max-w-2xl mx-auto">
            <Users className="w-8 h-8 text-skribble-azure mx-auto mb-4" />
            <h3 className="font-madimi text-xl text-skribble-sky mb-2">
              Refer Friends, Get Rewarded
            </h3>
            <p className="text-skribble-azure">
              For every friend you refer who becomes a paying customer, 
              you both get 1 month free! Share the love and save money.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}