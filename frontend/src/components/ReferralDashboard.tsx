// frontend/src/components/ReferralDashboard.tsx - FIXED VERSION
import { useState, useEffect } from 'react';
import { Copy, Users, Gift, Share2, Check, AlertCircle, Loader2 } from 'lucide-react';

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
      const token = localStorage.getItem('skribble_token') || localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      // Use users endpoint directly since it's confirmed to work
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/users-s3/referral-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to fetch referral stats');
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
      setError('Failed to fetch referral stats');
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('skribble_token') || localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found');
        setGenerating(false);
        return;
      }

      // Use users endpoint directly since it's confirmed to work
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/users-s3/generate-referral-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchReferralStats(); // Refresh stats
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to generate referral code');
      }
    } catch (error) {
      console.error('Error generating referral code:', error);
      setError('Failed to generate referral code');
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
    const text = `Join me on Skribble - the best music collaboration platform! Use my referral link and we both get 1 month free: ${referralUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join Skribble',
        text: text,
        url: referralUrl
      });
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <Loader2 className="w-6 h-6 text-skribble-azure animate-spin" />
          <h3 className="font-madimi text-xl text-skribble-sky">Loading Referral Data...</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-skribble-azure/20 rounded"></div>
          <div className="h-4 bg-skribble-azure/20 rounded w-3/4"></div>
          <div className="h-4 bg-skribble-azure/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-6 border border-red-500/20">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <h3 className="font-madimi text-xl text-skribble-sky">Error</h3>
        </div>
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchReferralStats}
          className="bg-skribble-azure text-white px-4 py-2 rounded-lg hover:bg-skribble-azure/80 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-6 border border-skribble-azure/20">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-skribble-azure" />
        <h3 className="font-madimi text-xl text-skribble-sky">Referral Program</h3>
      </div>

      {!stats?.referral_code ? (
        <div className="text-center py-8">
          <Gift className="w-12 h-12 text-skribble-azure mx-auto mb-4" />
          <h4 className="font-medium text-skribble-sky mb-2">
            Start Earning Free Months!
          </h4>
          <p className="text-skribble-azure mb-6">
            Generate your unique referral code and earn 1 month free for every friend who subscribes.
          </p>
          <button
            onClick={generateReferralCode}
            disabled={generating}
            className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-2 rounded-full font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
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
      ) : (
        <div className="space-y-6">
          {/* Referral Link */}
          <div>
            <label className="block text-skribble-azure text-sm mb-2">
              Your Referral Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={`${window.location.origin}/register?ref=${stats.referral_code}`}
                readOnly
                className="flex-1 px-4 py-2 rounded-lg bg-skribble-dark border border-skribble-azure/20 text-skribble-sky text-sm font-mono"
              />
              <button
                onClick={copyReferralLink}
                className="px-4 py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={shareReferralLink}
                className="px-4 py-2 bg-skribble-purple text-white rounded-lg hover:bg-skribble-purple/80 transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-skribble-dark/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-skribble-azure">
                {stats.successful_referrals}
              </div>
              <div className="text-skribble-sky text-sm">
                Successful Referrals
              </div>
            </div>
            
            <div className="bg-skribble-dark/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-skribble-purple">
                {stats.pending_referrals}
              </div>
              <div className="text-skribble-sky text-sm">
                Pending Referrals
              </div>
            </div>
            
            <div className="bg-skribble-dark/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-skribble-azure">
                {stats.rewards_earned}
              </div>
              <div className="text-skribble-sky text-sm">
                Free Months Earned
              </div>
            </div>
            
            <div className="bg-skribble-dark/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-skribble-purple">
                ${stats.rewards_earned * 19}
              </div>
              <div className="text-skribble-sky text-sm">
                Total Saved
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="border-t border-skribble-azure/20 pt-6">
            <h4 className="font-medium text-skribble-sky mb-3">How it works:</h4>
            <ul className="space-y-2 text-skribble-azure text-sm">
              <li className="flex items-start gap-2">
                <span className="text-skribble-azure font-bold">1.</span>
                Share your referral link with friends
              </li>
              <li className="flex items-start gap-2">
                <span className="text-skribble-azure font-bold">2.</span>
                They sign up and subscribe to any paid plan
              </li>
              <li className="flex items-start gap-2">
                <span className="text-skribble-azure font-bold">3.</span>
                You both get 1 month free automatically applied
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}