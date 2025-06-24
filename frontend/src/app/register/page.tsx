// frontend/src/app/register/page.tsx - FIXED TO REQUIRE PLAN SELECTION
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, User, Mail, Lock, Briefcase, Loader2, Gift, Check, Crown, Star } from 'lucide-react';

interface RegisterData {
  email: string;
  username: string;
  password: string;
  role: 'producer' | 'artist' | 'both';
  tier: 'indie' | 'producer' | 'studio';
  referralCode?: string;
}

const plans = [
  {
    name: 'Indie',
    tier: 'indie' as const,
    price: '$19',
    description: 'Perfect for independent creators',
    features: ['10 active projects', 'Advanced collaboration', '1 hour uploads', 'Priority support'],
    popular: false
  },
  {
    name: 'Producer', 
    tier: 'producer' as const,
    price: '$39',
    description: 'For professional producers',
    features: ['Unlimited projects', 'Team collaboration', 'Unlimited uploads', '24/7 support'],
    popular: true
  },
  {
    name: 'Studio',
    tier: 'studio' as const, 
    price: '$99',
    description: 'For studios and labels',
    features: ['Everything in Producer', 'White-label', 'API access', 'Dedicated support'],
    popular: false
  }
];

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams?.get('ref') || '';
  const preselectedPlan = searchParams?.get('plan') as 'indie' | 'producer' | 'studio' || null;

  const [step, setStep] = useState<'plan' | 'details'>('plan');
  const [selectedPlan, setSelectedPlan] = useState<'indie' | 'producer' | 'studio'>(
    preselectedPlan || 'producer'
  );
  
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    username: '',
    password: '',
    role: 'producer',
    tier: preselectedPlan || 'producer',
    referralCode: referralCode
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (referralCode) {
      setFormData(prev => ({ ...prev, referralCode }));
    }
    if (preselectedPlan) {
      setStep('details');
      setFormData(prev => ({ ...prev, tier: preselectedPlan }));
    }
  }, [referralCode, preselectedPlan]);

  const handlePlanSelect = (planTier: 'indie' | 'producer' | 'studio') => {
    setSelectedPlan(planTier);
    setFormData(prev => ({ ...prev, tier: planTier }));
    setStep('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      
      if (result.success && result.data) {
        // Store tokens with consistent naming
        localStorage.setItem('skribble_token', result.data.token);
        localStorage.setItem('skribble_refresh_token', result.data.refreshToken);
        localStorage.setItem('token', result.data.token); // Keep for backward compatibility
        
        // Show success message if referral was applied
        if (formData.referralCode && result.data.message) {
          console.log('Registration successful with referral:', result.data.message);
        }
        
        // Redirect to payment/dashboard based on response
        if (result.data.requiresPayment) {
          // Redirect to payment with plan info
          router.push(`/payment?plan=${formData.tier}&ref=${formData.referralCode || ''}`);
        } else {
          router.push('/dashboard');
        }
      } else {
        setError(result.error?.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof RegisterData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
      {/* Header */}
      <header className="relative z-50 px-6 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-skribble-sky hover:text-skribble-azure transition-colors">
            <ArrowLeft className="w-5 h-5" />
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
            Already have an account?{' '}
            <Link href="/login" className="text-skribble-sky hover:text-skribble-azure transition-colors">
              Sign In
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          {/* Referral Banner */}
          {referralCode && (
            <div className="mb-8 bg-green-500/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3 justify-center">
                <Gift className="w-5 h-5 text-green-400" />
                <div className="text-center">
                  <h3 className="text-green-400 font-medium">Referral Applied!</h3>
                  <p className="text-green-300 text-sm">
                    You'll get your first month free when you complete registration.
                  </p>
                </div>
                <Check className="w-5 h-5 text-green-400" />
              </div>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'plan' ? 'bg-skribble-azure text-white' : 'bg-green-500 text-white'
              }`}>
                {step === 'details' ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className="text-skribble-azure">Choose Plan</div>
              <div className="w-8 h-1 bg-skribble-azure/20"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'details' ? 'bg-skribble-azure text-white' : 'bg-skribble-azure/20 text-skribble-azure'
              }`}>
                2
              </div>
              <div className="text-skribble-azure">Your Details</div>
            </div>
          </div>

          {step === 'plan' ? (
            /* Plan Selection */
            <div>
              <div className="text-center mb-8">
                <h1 className="font-madimi text-3xl text-skribble-sky mb-2">Choose Your Plan</h1>
                <p className="text-skribble-azure">Select the plan that fits your needs. All plans include a 14-day free trial.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {plans.map((plan) => (
                  <div 
                    key={plan.tier}
                    onClick={() => handlePlanSelect(plan.tier)}
                    className={`relative bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-6 border transition-all duration-300 hover:transform hover:scale-105 cursor-pointer ${
                      plan.popular 
                        ? 'border-skribble-azure shadow-lg shadow-skribble-azure/25' 
                        : 'border-skribble-azure/20 hover:border-skribble-azure/40'
                    } ${selectedPlan === plan.tier ? 'ring-2 ring-skribble-azure' : ''}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <div className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Most Popular
                        </div>
                      </div>
                    )}
                    
                    <div className="text-center mb-6">
                      <h3 className="font-madimi text-xl text-skribble-sky mb-2">{plan.name}</h3>
                      <div className="mb-2">
                        <span className="text-3xl font-bold text-skribble-azure">{plan.price}</span>
                        <span className="text-skribble-purple">/month</span>
                      </div>
                      <p className="text-skribble-azure text-sm">{plan.description}</p>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-skribble-azure flex-shrink-0" />
                          <span className="text-skribble-sky text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button className={`w-full py-2 rounded-lg font-medium transition-all duration-300 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-skribble-azure to-skribble-purple text-white'
                        : 'bg-skribble-dark border border-skribble-azure text-skribble-azure hover:bg-skribble-azure hover:text-white'
                    }`}>
                      Select Plan
                    </button>

                    {referralCode && (
                      <div className="mt-2 text-center">
                        <span className="text-green-400 text-xs flex items-center justify-center gap-1">
                          <Gift className="w-3 h-3" />
                          First month FREE!
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Registration Form */
            <div className="max-w-md mx-auto">
              <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
                <div className="text-center mb-6">
                  <h1 className="font-madimi text-2xl text-skribble-sky mb-2">Create Your Account</h1>
                  <div className="flex items-center justify-center gap-2 text-skribble-azure text-sm">
                    <Crown className="w-4 h-4" />
                    Selected: {plans.find(p => p.tier === formData.tier)?.name} Plan
                  </div>
                  <button 
                    onClick={() => setStep('plan')}
                    className="text-skribble-azure hover:text-skribble-sky text-xs mt-1"
                  >
                    Change plan
                  </button>
                </div>

                {error && (
                  <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-skribble-azure text-sm mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-skribble-azure/60" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-skribble-azure text-sm mb-2">Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-skribble-azure/60" />
                      <input
                        type="text"
                        required
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none"
                        placeholder="yourusername"
                        minLength={3}
                        maxLength={30}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-skribble-azure text-sm mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-skribble-azure/60" />
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky placeholder-skribble-azure/60 focus:border-skribble-azure focus:outline-none"
                        placeholder="Choose a strong password"
                        minLength={8}
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-skribble-azure text-sm mb-2">I am a...</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-skribble-azure/60" />
                      <select
                        value={formData.role}
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky focus:border-skribble-azure focus:outline-none appearance-none"
                      >
                        <option value="producer">Producer</option>
                        <option value="artist">Artist</option>
                        <option value="both">Both Producer & Artist</option>
                      </select>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-skribble-azure to-skribble-purple text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Start Free Trial
                        {referralCode && <Gift className="w-4 h-4" />}
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-skribble-azure text-xs mt-4">
                  14-day free trial • No credit card required • Cancel anytime
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}