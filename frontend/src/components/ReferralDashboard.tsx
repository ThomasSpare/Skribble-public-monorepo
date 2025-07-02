// frontend/src/components/ReferralDashboard.tsx - FIXED VERSION
'use client';
import { useState, useEffect } from 'react';
import { Copy, Users, Gift, Share2, Check, AlertCircle, Loader2 } from 'lucide-react';
import { auth } from '@/lib/auth';

interface ReferralStats {
  referral_code: string | null;
  successful_referrals: number;
  pending_referrals: number;
  rewards_earned: number;
}

export default function ReferralDashboard() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReferralStats();
  }, []);

  const fetchReferralStats = async () => {
    try {
      const token = auth.getToken();
      
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      // FIXED: Try stripe endpoint first, then users endpoint as fallback
      let response;
      let data;
      
      try {
        // Try stripe endpoint
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/referral-stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          data = await response.json();
          if (data.success) {
            setStats(data.data);
            setError(null);
            setLoading(false);
            return;
          }
        }
      } catch (stripeError) {
        console.log('Stripe endpoint failed, trying users endpoint...');
      }
      
      // Fallback to users endpoint
      try {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/referral-stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        data = await response.json();
        if (data.success) {
          setStats(data.data);
          setError(null);
        } else {
          throw new Error(data.error?.message || 'Failed to fetch referral stats');
        }
      } catch (usersError) {
        throw new Error('Both stripe and users endpoints failed');
      }
      
    } catch (error) {
      console.error('Error fetching referral stats:', error);
      setError('Failed to fetch referral stats. Please check that the API endpoints are working.');
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      const token = auth.getToken();
      
      if (!token) {
        setError('No authentication token found');
        setGenerating(false);
        return;
      }

      // FIXED: Try stripe endpoint first, then users endpoint as fallback
      let response;
      let data;
      
      try {
        // Try stripe endpoint
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/generate-referral-code`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          data = await response.json();
          if (data.success) {
            await fetchReferralStats(); // Refresh stats
            setError(null);
            setGenerating(false);
            return;
          }
        }
      } catch (stripeError) {
        console.log('Stripe endpoint failed, trying users endpoint...');
      }
      
      // Fallback to users endpoint
      try {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/generate-referral-code`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        data = await response.json();
        if (data.success) {
          await fetchReferralStats(); // Refresh stats
          setError(null);
        } else {
          throw new Error(data.error?.message || 'Failed to generate referral code');
        }
      } catch (usersError) {
        throw new Error('Both stripe and users endpoints failed');
      }
      
    } catch (error) {
      console.error('Error generating referral code:', error);
      setError('Failed to generate referral code. Please check that the API endpoints are working.');
    } finally {
      setGenerating(false);
    }
  };

  const copyReferralLink = () => {
    if (!stats?.referral_code) return;
    
    const referralUrl = `${window.location.origin}/register?ref=${stats.referral_code}`;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferralLink = () => {
    if (!stats?.referral_code) return;
    
    const referralUrl = `${window.location.origin}/register?ref=${stats.referral_code}`;
    const text = `Join me on Skribble - the best music collaboration platform! Use my referral code for a discount: ${referralUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join Skribble',
        text: text,
        url: referralUrl,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-skribble-azure" />
        <span className="ml-2 text-skribble-azure">Loading referral data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 p-6 rounded-lg border border-red-400/20">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error Loading Referrals</span>
        </div>
        <p className="text-red-400/70 text-sm mb-4">{error}</p>
        <button
          onClick={fetchReferralStats}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Code Section */}
      <div className="bg-skribble-plum/20 p-6 rounded-lg border border-skribble-azure/20">
        <h4 className="text-skribble-sky font-medium mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Your Referral Code
        </h4>
        
        {stats?.referral_code ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-skribble-plum/30 rounded-lg border">
              <code className="flex-1 font-mono text-lg font-bold text-skribble-sky">
                {stats.referral_code}
              </code>
              <button
                onClick={copyReferralLink}
                className="p-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors"
                title="Copy referral link"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={shareReferralLink}
                className="p-2 bg-skribble-purple text-white rounded-lg hover:bg-skribble-purple/80 transition-colors"
                title="Share referral link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-skribble-azure/70 text-sm">
              Share this link: <span className="font-mono text-skribble-sky">
                {window.location.origin}/register?ref={stats.referral_code}
              </span>
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-skribble-azure/70 mb-4">You don't have a referral code yet.</p>
            <button
              onClick={generateReferralCode}
              disabled={generating}
              className="px-6 py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  Generate Referral Code
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Referral Stats */}
      {stats?.referral_code && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-skribble-plum/20 p-6 rounded-lg border border-skribble-azure/20 text-center">
            <Users className="w-8 h-8 text-skribble-azure mx-auto mb-2" />
            <div className="text-2xl font-bold text-skribble-sky">{stats.successful_referrals}</div>
            <div className="text-skribble-azure/70 text-sm">Successful Referrals</div>
          </div>
          
          <div className="bg-skribble-plum/20 p-6 rounded-lg border border-skribble-azure/20 text-center">
            <Gift className="w-8 h-8 text-skribble-purple mx-auto mb-2" />
            <div className="text-2xl font-bold text-skribble-sky">{stats.pending_referrals}</div>
            <div className="text-skribble-azure/70 text-sm">Pending Referrals</div>
          </div>
          
          <div className="bg-skribble-plum/20 p-6 rounded-lg border border-skribble-azure/20 text-center">
            <Gift className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-skribble-sky">${stats.rewards_earned}</div>
            <div className="text-skribble-azure/70 text-sm">Rewards Earned</div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-skribble-plum/20 p-6 rounded-lg border border-skribble-azure/20">
        <h4 className="text-skribble-sky font-medium mb-4">How Referrals Work</h4>
        <ul className="space-y-2 text-skribble-azure/70 text-sm">
          <li>• Share your referral code with friends and colleagues</li>
          <li>• They get a discount on their first subscription</li>
          <li>• You earn rewards when they subscribe</li>
          <li>• Track your progress in real-time</li>
        </ul>
      </div>
    </div>
  );
}