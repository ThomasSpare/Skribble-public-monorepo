// frontend/src/app/pricing/page.tsx - SIMPLE PRICING WITH REFERRAL SUPPORT
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Gift, Star, ArrowRight, Users } from 'lucide-react';

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams?.get('ref') || '';
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans = [
    {
      name: 'Free',
      tier: 'free',
      price: '$0',
      description: 'Perfect for trying out Skribble',
      features: [
        '1 project at a time',
        'Basic collaboration',
        '5 minute audio uploads',
        'Community support'
      ],
      buttonText: 'Get Started Free',
      popular: false
    },
    {
      name: 'Indie',
      tier: 'indie',
      price: '$7',
      description: 'For independent artists and producers',
      features: [
        '5 active projects',
        'Advanced collaboration tools',
        'Up to 2 collaborators',
        'Priority support',
        'Export to DAW',
        'Voice notes'
      ],
      buttonText: 'Start Free Trial',
      popular: true
    },
    {
      name: 'Producer',
      tier: 'producer',
      price: '$19',
      description: 'For professional producers',
      features: [
        '20 projects',
        'Team collaboration',
        'Unlimited audio uploads',
        '24/7 priority support',
        'Advanced export options',
      ],
      buttonText: 'Start Free Trial',
      popular: false
    },
    {
      name: 'Studio',
      tier: 'studio',
      price: '$49',
      description: 'For recording studios and labels',
      features: [
        'Everything in Producer',
        'White-label solution',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee'
      ],
      buttonText: 'Contact Sales',
      popular: false
    }
  ];

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan.tier);
    
    // Redirect to register with plan and referral code
    const params = new URLSearchParams();
    if (referralCode) params.set('ref', referralCode);
    if (plan.tier !== 'free') params.set('plan', plan.tier);
    
    const redirectUrl = `/register${params.toString() ? `?${params.toString()}` : ''}`;
    router.push(redirectUrl);
  };

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
          
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-skribble-azure hover:text-skribble-sky transition-colors">
              Sign In
            </Link>
            <Link 
              href="/register" 
              className="bg-skribble-azure text-white px-4 py-2 rounded-lg hover:bg-skribble-azure/80 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="px-6 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Referral Banner */}
          {referralCode && (
            <div className="max-w-4xl mx-auto mb-12">
              <div className="bg-gradient-to-r from-green-500/20 to-skribble-azure/20 border border-green-500/30 rounded-2xl p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Gift className="w-6 h-6 text-green-400" />
                  <h3 className="text-xl font-madimi text-green-400">Special Referral Offer!</h3>
                  <Gift className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-green-300 mb-2">
                  You've been invited to join Skribble! 
                </p>
                <p className="text-skribble-azure text-sm">
                  Sign up for any paid plan and get <strong>your first month absolutely free</strong> - plus your friend gets a free month too!
                </p>
              </div>
            </div>
          )}

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="font-madimi text-5xl md:text-6xl text-skribble-sky mb-6">
              Choose Your Plan
            </h1>
            <p className="text-xl text-skribble-azure max-w-2xl mx-auto mb-8">
              Start collaborating on music projects today. All plans include a 14-day free trial.
            </p>
            
            {!referralCode && (
              <div className="bg-skribble-plum/30 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-center gap-2 justify-center text-skribble-azure">
                  <Users className="w-5 h-5" />
                  <span className="text-sm">Have a referral code? Enter it during signup for a free month!</span>
                </div>
              </div>
            )}
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <div 
                key={index} 
                className={`relative bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border transition-all duration-300 hover:transform hover:scale-105 cursor-pointer ${
                  plan.popular 
                    ? 'border-skribble-azure shadow-lg shadow-skribble-azure/25' 
                    : 'border-skribble-azure/20 hover:border-skribble-azure/40'
                } ${selectedPlan === plan.tier ? 'ring-2 ring-skribble-azure' : ''}`}
                onClick={() => handleSelectPlan(plan)}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="font-madimi text-2xl text-skribble-sky mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-skribble-azure">{plan.price}</span>
                    {plan.tier !== 'free' && <span className="text-skribble-purple">/month</span>}
                  </div>
                  <p className="text-skribble-azure text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-skribble-azure flex-shrink-0" />
                      <span className="text-skribble-sky text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  className={`w-full py-3 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-skribble-azure to-skribble-purple text-white hover:shadow-lg'
                      : plan.tier === 'free'
                      ? 'bg-skribble-dark border border-skribble-azure text-skribble-azure hover:bg-skribble-azure hover:text-white'
                      : 'bg-skribble-plum text-skribble-sky hover:bg-skribble-azure hover:text-white'
                  }`}
                >
                  {plan.buttonText}
                  <ArrowRight className="w-4 h-4" />
                </button>

                {referralCode && plan.tier !== 'free' && (
                  <div className="mt-3 text-center">
                    <span className="text-green-400 text-xs flex items-center justify-center gap-1">
                      <Gift className="w-3 h-3" />
                      First month FREE with referral!
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* FAQ or Additional Info */}
          <div className="max-w-4xl mx-auto mt-16 text-center">
            <h3 className="font-madimi text-2xl text-skribble-sky mb-6">Why Choose Skribble?</h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-skribble-plum/20 rounded-lg p-6">
                <h4 className="text-skribble-azure font-medium mb-2">Real-time Collaboration</h4>
                <p className="text-skribble-sky text-sm">Work together in real-time with instant feedback and comments.</p>
              </div>
              <div className="bg-skribble-plum/20 rounded-lg p-6">
                <h4 className="text-skribble-azure font-medium mb-2">Professional Tools</h4>
                <p className="text-skribble-sky text-sm">Export to your favorite DAW with timestamps and project files.</p>
              </div>
              <div className="bg-skribble-plum/20 rounded-lg p-6">
                <h4 className="text-skribble-azure font-medium mb-2">Secure & Private</h4>
                <p className="text-skribble-sky text-sm">Your music is protected with enterprise-grade security.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}