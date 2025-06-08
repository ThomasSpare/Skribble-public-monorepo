// frontend/src/app/register/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Lock, Briefcase, Loader2 } from 'lucide-react';
import { apiClient, RegisterData } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    username: '',
    password: '',
    role: 'producer'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.register(formData);
      
      if (result.success && result.data) {
        // Store tokens
        localStorage.setItem('skribble_token', result.data.token);
        localStorage.setItem('skribble_refresh_token', result.data.refreshToken);
        
        // Redirect to dashboard (we'll create this later)
        router.push('/dashboard');
      } else {
        setError(result.error?.message || 'Registration failed');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof RegisterData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
            <Link href="/login" className="text-skribble-sky hover:text-white transition-colors">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      {/* Register Form */}
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="bg-skribble-plum/30 backdrop-blur-md rounded-2xl p-8 border border-skribble-azure/20">
          <div className="text-center mb-8">
            <h1 className="font-madimi text-3xl text-skribble-sky mb-2">
              Join Skribble
            </h1>
            <p className="text-skribble-azure">
              Start collaborating on music projects today
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-skribble-azure mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-purple" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-skribble-plum/50 border border-skribble-azure/30 rounded-lg text-skribble-sky placeholder-skribble-purple/70 focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all"
                  placeholder="producer@example.com"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-skribble-azure mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-purple" />
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={30}
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-skribble-plum/50 border border-skribble-azure/30 rounded-lg text-skribble-sky placeholder-skribble-purple/70 focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all"
                  placeholder="beatmaker"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-skribble-azure mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-purple" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-skribble-plum/50 border border-skribble-azure/30 rounded-lg text-skribble-sky placeholder-skribble-purple/70 focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-xs text-skribble-purple/70 mt-1">
                Minimum 8 characters
              </p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-skribble-azure mb-2">
                I am a...
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-skribble-purple" />
                <select
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value as RegisterData['role'])}
                  className="w-full pl-10 pr-4 py-3 bg-skribble-plum/50 border border-skribble-azure/30 rounded-lg text-skribble-sky focus:border-skribble-azure focus:ring-2 focus:ring-skribble-azure/20 transition-all"
                >
                  <option value="producer">Producer</option>
                  <option value="artist">Artist</option>
                  <option value="both">Both Producer & Artist</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-skribble-azure to-skribble-purple text-white py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-skribble-purple/70">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-skribble-azure hover:text-skribble-sky transition-colors">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-skribble-azure hover:text-skribble-sky transition-colors">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}