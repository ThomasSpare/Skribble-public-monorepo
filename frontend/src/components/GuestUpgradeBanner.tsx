// frontend/src/components/GuestUpgradeBanner.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Crown, X, Gift, ArrowRight } from 'lucide-react';

interface GuestInfo {
  daysRemaining: number;
  expiresAt: string;
  needsUpgrade: boolean;
}

interface GuestUpgradeBannerProps {
  onClose?: () => void;
  variant?: 'banner' | 'modal' | 'inline';
}

export default function GuestUpgradeBanner({ onClose, variant = 'banner' }: GuestUpgradeBannerProps) {
  const router = useRouter();
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchGuestInfo();
  }, []);

  const fetchGuestInfo = async () => {
    try {
      const token = localStorage.getItem('skribble_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/guest-info`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setGuestInfo(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch guest info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    router.push('/pricing?upgrade=guest');
  };

  const handleDismiss = () => {
    setDismissed(true);
    onClose?.();
  };

  if (loading || !guestInfo || dismissed) return null;

  const { daysRemaining, needsUpgrade } = guestInfo;
  
  // Different urgency levels
  const getUrgencyLevel = () => {
    if (daysRemaining <= 1) return 'critical';
    if (daysRemaining <= 3) return 'high';
    if (daysRemaining <= 7) return 'medium';
    return 'low';
  };

  const urgency = getUrgencyLevel();

  // Banner variant (top of page)
  if (variant === 'banner') {
    return (
      <div className={`w-full ${
        urgency === 'critical' ? 'bg-red-500/20 border-red-500/30' :
        urgency === 'high' ? 'bg-orange-500/20 border-orange-500/30' :
        urgency === 'medium' ? 'bg-yellow-500/20 border-yellow-500/30' :
        'bg-blue-500/20 border-blue-500/30'
      } border-b backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                urgency === 'critical' ? 'bg-red-500/30' :
                urgency === 'high' ? 'bg-orange-500/30' :
                urgency === 'medium' ? 'bg-yellow-500/30' :
                'bg-blue-500/30'
              }`}>
                {urgency === 'critical' || urgency === 'high' ? 
                  <Clock className="w-4 h-4 text-white" /> :
                  <Gift className="w-4 h-4 text-white" />
                }
              </div>
              <div>
                <p className="text-white font-medium">
                  {urgency === 'critical' ? 
                    `Guest access expires ${daysRemaining === 0 ? 'today' : 'tomorrow'}!` :
                    `${daysRemaining} days left in your free trial`
                  }
                </p>
                <p className={`text-sm ${
                  urgency === 'critical' ? 'text-red-300' :
                  urgency === 'high' ? 'text-orange-300' :
                  urgency === 'medium' ? 'text-yellow-300' :
                  'text-blue-300'
                }`}>
                  Upgrade to keep collaborating and unlock more features
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleUpgrade}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                  urgency === 'critical' ? 
                    'bg-red-500 hover:bg-red-600 text-white' :
                    'bg-gradient-to-r from-skribble-azure to-skribble-purple hover:shadow-lg hover:shadow-skribble-azure/25 text-white'
                }`}
              >
                Upgrade Now
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modal variant (overlay)
  if (variant === 'modal' && needsUpgrade) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-skribble-dark border border-skribble-azure/20 rounded-2xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center mx-auto mb-6">
              <Crown className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="font-madimi text-2xl text-white mb-4">
              {daysRemaining <= 1 ? 'Trial Ending Soon!' : 'Loving Skribble?'}
            </h2>
            
            <p className="text-skribble-azure mb-6">
              {daysRemaining <= 1 ? 
                'Your free trial expires today. Upgrade now to keep collaborating!' :
                `You have ${daysRemaining} days left in your free trial. Upgrade to unlock the full potential of music collaboration.`
              }
            </p>

            <div className="space-y-4 mb-6">
              <div className="bg-skribble-plum/30 rounded-lg p-4">
                <h3 className="font-medium text-white mb-2">Upgrade Benefits:</h3>
                <ul className="text-sm text-skribble-azure space-y-1 text-left">
                  <li>• Create your own projects</li>
                  <li>• Invite unlimited collaborators</li>
                  <li>• Advanced export features</li>
                  <li>• Priority support</li>
                  <li>• No time limits</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 bg-skribble-dark/50 border border-skribble-azure/30 text-skribble-azure py-3 rounded-lg hover:border-skribble-azure/50 transition-colors"
              >
                Maybe Later
              </button>
              <button
                onClick={handleUpgrade}
                className="flex-1 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white py-3 rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant (within project interface)
  if (variant === 'inline') {
    return (
      <div className="bg-gradient-to-r from-skribble-azure/20 to-skribble-purple/20 rounded-xl p-6 border border-skribble-azure/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-r from-skribble-azure to-skribble-purple rounded-full flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white mb-2">
              {daysRemaining} Days Left in Trial
            </h3>
            <p className="text-skribble-azure text-sm mb-4">
              You're collaborating as a guest. Upgrade to create projects, invite others, and unlock premium features.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleUpgrade}
                className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300"
              >
                Upgrade Account
              </button>
              <button
                onClick={handleDismiss}
                className="text-skribble-azure hover:text-white text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}