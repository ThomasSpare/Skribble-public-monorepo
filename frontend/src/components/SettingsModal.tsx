// frontend/src/components/SettingsModal.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  X, User, Camera, Save, Loader2, Users, Check,
  Crown, CreditCard, Bell, Shield, Mail, AlertCircle, Eye, Lock, EyeOff,
  Trash2, Calendar, CreditCard as CreditCardIcon,
  Settings, LogOut, Download, ArrowLeft, ChevronRight
} from 'lucide-react';
import Image from 'next/image';
import { auth } from '@/lib/auth';
import ReferralDashboard from './ReferralDashboard';
// import { getImageUrl } from '@/utils/images';
// import UserAvatar from './userAvatar';


interface User {
  id: string;
  email: string;
  username: string;
  role: 'producer' | 'artist' | 'both';
  subscriptionTier: string;
  subscriptionStatus?: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
  trial_used?: boolean;
  trial_end_date?: string;
  referral_code?: string;
}

interface SettingsModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: User) => void;
  onLogout: () => void;
}

type SettingsTab = 'profile' | 'referrals' | 'subscription' | 'notifications' | 'privacy' | 'data';

interface NotificationSettings {
  collaborations: boolean;
  projects: boolean;
  weekly: boolean;
  marketing: boolean;
  email: boolean;
  push: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private';
  showEmail: boolean;
  allowDirectMessages: boolean;
  indexInSearch: boolean;
}

interface SubscriptionInfo {
  tier: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'inactive';
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string;
  paymentMethod?: {
    type: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
}

export default function SettingsModal({ user, isOpen, onClose, onUserUpdate, onLogout }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showMobileMenu, setShowMobileMenu] = useState(true); // New state for mobile menu
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passwordData, setPasswordData] = useState({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});
const [showPasswords, setShowPasswords] = useState({
  current: false,
  new: false,
  confirm: false
});

  // Profile form state
  const [profileData, setProfileData] = useState({
    username: user.username,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage || ''
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    collaborations: true,
    projects: true,
    weekly: true,
    marketing: false,
    email: true,
    push: true
  });

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    profileVisibility: 'public',
    showEmail: false,
    allowDirectMessages: true,
    indexInSearch: true
  });

  // Subscription info
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'referrals' as SettingsTab, label: 'Referrals', icon: Users },
    { id: 'subscription' as SettingsTab, label: 'Subscription', icon: Crown },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
    { id: 'privacy' as SettingsTab, label: 'Privacy', icon: Shield },
    { id: 'data' as SettingsTab, label: 'Data & Security', icon: Settings }
  ];

  const [imageUrlExpired, setImageUrlExpired] = useState(false);
  const [refreshingImageUrl, setRefreshingImageUrl] = useState(false);

  // Reset form when user changes
  useEffect(() => {
    setProfileData({
      username: user.username,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || ''
    });
    setPreviewImage(null);
    setSelectedFile(null);
  }, [user]);

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUserSettings();
      setShowMobileMenu(true); // Reset to show mobile menu when modal opens
      setActiveTab('profile'); // Reset to profile tab
    }
  }, [isOpen]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const loadUserSettings = async () => {
    setIsLoading(true);
    try {
      const token = auth.getToken();
      
      // Load all settings in parallel
      const [notifResponse, privacyResponse, subResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/notification-settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/privacy-settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/subscription-info`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (notifResponse.ok) {
        const notifData = await notifResponse.json();
        if (notifData.success) {
          setNotificationSettings(notifData.data);
        }
      }

      if (privacyResponse.ok) {
        const privacyData = await privacyResponse.json();
        if (privacyData.success) {
          setPrivacySettings(privacyData.data);
        }
      }

      if (subResponse.ok) {
        const subData = await subResponse.json();
        if (subData.success) {
          setSubscriptionInfo(subData.data);
        }
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setIsSaving(true);
    setError(null);

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('All password fields are required');
      setIsSaving(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setIsSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setIsSaving(false);
      return;
    }

    try {
      const token = auth.getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(passwordData)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Password changed successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        throw new Error(data.error.message);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const refreshImageUrl = async () => {
  setRefreshingImageUrl(true);
  try {
    const token = auth.getToken();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile/refresh-image-url`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      // Update the profile data with new signed URL
      setProfileData(prev => ({
        ...prev,
        profileImage: data.data.imageUrl
      }));
      
      // Also update the parent component
      onUserUpdate({
        ...user,
        profileImage: data.data.imageUrl
      });
      
      setImageUrlExpired(false);
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Failed to refresh image URL:', error);
    setError('Failed to refresh image URL');
  } finally {
    setRefreshingImageUrl(false);
  }
};

const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  const imgSrc = img.src;
  
  console.error('❌ Image failed to load:', imgSrc);
  
  // Check if it's a signed URL that might have expired
  if (imgSrc.includes('X-Amz-') && imgSrc.includes('s3')) {    
    try {
      // Try to fetch the URL to get the actual error
      const testResponse = await fetch(imgSrc, { method: 'HEAD' });
      if (testResponse.status === 403) {
        setImageUrlExpired(true);
        return; // Don't hide the image yet, show refresh option
      }
    } catch (fetchError) {
      setImageUrlExpired(true);
      return;
    }
  }
    img.style.display = 'none';
  const fallback = document.createElement('div');
  fallback.className = 'w-full h-full flex items-center justify-center bg-gradient-to-br from-skribble-azure to-skribble-purple';
  fallback.innerHTML = `
    <span class="text-white font-medium text-lg">
      ${profileData.username.charAt(0).toUpperCase()}
    </span>
  `;
  img.parentElement?.appendChild(fallback);
};


  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image must be less than 5MB');
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSave = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const token = auth.getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const formData = new FormData();
      
      formData.append('username', profileData.username);
      formData.append('email', profileData.email);
      formData.append('role', profileData.role);
      
      if (selectedFile) {
        formData.append('profileImage', selectedFile);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (response.status === 401) {
        auth.clear(); // Clear invalid tokens
        throw new Error('Authentication expired. Please log in again.');
      }

      const data = await response.json();
      
      if (data.success) {
        onUserUpdate(data.data);
        setSuccess('Profile updated successfully');
        setSelectedFile(null);
        setPreviewImage(user.profileImage || null);
      } else {
        throw new Error(data.error.message);
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      setError(error.message || 'Failed to update profile');
      if (error.message.includes('Authentication')) {
        onLogout(); // This should also call auth.clear()
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationSave = async () => {
    setIsSaving(true);
    try {
      const token = auth.getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/notification-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notificationSettings)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Notification settings updated');
      } else {
        throw new Error(data.error.message);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update notifications');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrivacySave = async () => {
    setIsSaving(true);
    try {
      const token = auth.getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/privacy-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(privacySettings)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Privacy settings updated');
      } else {
        throw new Error(data.error.message);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update privacy settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const token = auth.getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        window.open(data.data.url, '_blank');
      } else {
        throw new Error(data.error.message);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to open billing portal');
    }
  };

  const handleDataExport = async () => {
    try {
      const token = auth.getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/export-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `skribble-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccess('Data exported successfully');
      } else {
        throw new Error('Failed to export data');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to export data');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    if (!window.confirm('This will permanently delete all your projects, collaborations, and data. Type DELETE to confirm.')) {
      return;
    }

    try {
      const token = auth.getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/delete-account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        alert('Account deleted successfully');
        onLogout();
      } else {
        throw new Error(data.error.message);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete account');
    }
  };

  const getSubscriptionColor = (tier: string) => {
    switch (tier) {
      case 'indie':
      case 'indie_trial':
        return 'text-blue-400';
      case 'producer':
        return 'text-purple-400';
      case 'studio':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getSubscriptionFeatures = (tier: string) => {
    const features: Record<string, string[]> = {
      'free': ['1 project', '1 collaborator', '25MB files'],
      'indie': ['5 projects', '2 collaborators', '50MB files', 'Basic exports'],
      'indie_trial': ['5 projects', '2 collaborators', '50MB files', 'Basic exports'],
      'producer': ['25 projects', '10 collaborators', '200MB files', 'All exports', 'Voice notes'],
      'studio': ['Unlimited projects', 'Unlimited collaborators', '1GB files', 'White-label', 'Analytics']
    };
    return features[tier] || features['free'];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="bg-skribble-dark border border-skribble-azure/20 w-full h-full sm:rounded-2xl sm:max-w-4xl sm:w-full sm:max-h-[90vh] sm:h-auto overflow-hidden flex flex-col">
        
        {/* Mobile-Responsive Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-skribble-azure/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Back Button - Show when not on main menu */}
            <button
              onClick={() => setShowMobileMenu(true)}
              className={`sm:hidden p-2 rounded-lg hover:bg-skribble-plum/30 text-skribble-azure transition-colors touch-target ${
                showMobileMenu ? 'hidden' : 'block'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <h2 className="font-madimi text-xl sm:text-2xl text-skribble-sky">
              {/* Dynamic title for mobile */}
              <span className="sm:hidden">
                {showMobileMenu ? 'Settings' : tabs.find(t => t.id === activeTab)?.label}
              </span>
              <span className="hidden sm:block">Settings</span>
            </h2>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-skribble-plum/30 text-skribble-azure transition-colors touch-target"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-2 sm:mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-4 sm:mx-6 mt-2 sm:mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-start gap-2 flex-shrink-0">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Responsive Sidebar Navigation - FIXED */}
          <div className={`w-full sm:w-64 border-r border-skribble-azure/20 bg-skribble-dark/50 sm:bg-transparent flex-shrink-0 overflow-y-auto ${
            // Mobile: Show sidebar when showMobileMenu is true
            // Desktop: Always show sidebar  
            showMobileMenu ? 'block' : 'hidden'
          } sm:block`}>
            <nav className="p-4 sm:p-6 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMobileMenu(false); // Hide mobile menu on tab selection
                    }}
                    className={`w-full flex items-center gap-3 px-3 sm:px-4 py-3 rounded-lg text-left transition-colors touch-target min-h-[44px] ${
                      activeTab === tab.id
                        ? 'bg-skribble-azure/20 text-skribble-sky'
                        : 'text-skribble-azure hover:bg-skribble-plum/30'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm sm:text-base flex-1">{tab.label}</span>
                    <ChevronRight className="w-4 h-4 sm:hidden" />
                  </button>
                );
              })}
              
              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 rounded-lg text-left transition-colors text-red-400 hover:bg-red-500/20 mt-8 border-t border-skribble-azure/20 pt-4 touch-target min-h-[44px]"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">Logout</span>
              </button>
            </nav>
          </div>

          {/* Content Area - FIXED MOBILE LOGIC */}
         <div className={`flex-1 overflow-y-auto ${
            // Mobile: Show content when not showing mobile menu
            // Desktop: Always show content
            showMobileMenu ? 'hidden' : 'block'
          } sm:block`}>
            <div className="p-4 sm:p-6">
              
              {/* Profile Tab Content */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h3 className="font-madimi text-lg sm:text-xl text-skribble-sky mb-4 hidden sm:block">
                    Profile Settings
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <div className="relative flex-shrink-0">
                    <div className="w-24 h-24 sm:w-20 sm:h-20 rounded-full bg-skribble-plum/30 overflow-hidden border-2 border-skribble-azure/20">
                      {previewImage ? (
                        <Image
                          src={previewImage}
                          alt="Profile Preview"
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      ) : profileData.profileImage && !imageUrlExpired ? (
                          <Image
                            src={profileData.profileImage}
                            alt="Profile"
                            width={96}
                            height={96}
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                            onLoad={() => setImageUrlExpired(false)}
                          />
                        ) : imageUrlExpired ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-skribble-plum/50 p-2">
                            <AlertCircle className="w-6 h-6 text-yellow-400 mb-1" />
                            <p className="text-xs text-skribble-azure text-center">Image expired</p>
                            <button
                              onClick={refreshImageUrl}
                              disabled={refreshingImageUrl}
                              className="mt-1 px-2 py-1 bg-skribble-azure text-white rounded text-xs hover:bg-skribble-azure/80 disabled:opacity-50 touch-target"
                            >
                              {refreshingImageUrl ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                'Refresh'
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-skribble-azure to-skribble-purple">
                            <span className="text-white font-medium text-xl sm:text-lg">
                              {profileData.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 p-2 bg-skribble-azure rounded-full text-white hover:bg-skribble-azure/80 transition-colors touch-target"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </div>
                    
                    <div className="text-center sm:text-left">
                      <h4 className="text-skribble-sky font-medium">Profile Photo</h4>
                      <p className="text-skribble-azure/70 text-sm">
                        Upload a photo to personalize your profile
                      </p>
                    </div>
                  </div>

                  {/* Mobile-Optimized Form Fields */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-skribble-azure text-sm font-medium mb-2">
                          Username
                        </label>
                        <input
                          type="text"
                          value={profileData.username}
                          onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                          className="w-full px-3 py-3 sm:py-2 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky text-base sm:text-sm focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure focus:outline-none touch-target"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-skribble-azure text-sm font-medium mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileData.email}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          className="w-full px-3 py-3 sm:py-2 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky text-base sm:text-sm focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure focus:outline-none touch-target"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-skribble-azure text-sm font-medium mb-2">
                        Role
                      </label>
                      <select
                        value={profileData.role}
                        onChange={(e) => setProfileData({ ...profileData, role: e.target.value as any })}
                        className="w-full px-3 py-3 sm:py-2 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky text-base sm:text-sm focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure focus:outline-none touch-target"
                      >
                        <option value="producer">Producer</option>
                        <option value="artist">Artist</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                  </div>

                  {/* Mobile Sticky Save Button */}
                  <div className="sticky bottom-0 sm:relative bg-skribble-dark sm:bg-transparent pt-4 sm:pt-0 pb-safe sm:pb-0 -mx-4 sm:mx-0 px-4 sm:px-0 border-t sm:border-t-0 border-skribble-azure/20 sm:border-0">
                    <button
                      onClick={handleProfileSave}
                      disabled={isSaving}
                      className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50 font-medium text-base sm:text-sm touch-target flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Data & Security Tab - Mobile Optimized - FIXED */}
              {activeTab === 'data' && (
                <div className="space-y-6">
                  <h3 className="font-madimi text-lg sm:text-xl text-skribble-sky mb-4 hidden sm:block">
                    Data & Security
                  </h3>
                  
                  {/* Change Password Section - Mobile Optimized */}
                  <div className="bg-skribble-plum/20 p-4 sm:p-6 rounded-lg border border-skribble-azure/20">
                    <h4 className="text-skribble-sky font-medium mb-4 flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      Change Password
                    </h4>
                    
                    <div className="space-y-4">
                      {/* Current Password */}
                      <div>
                        <label className="block text-skribble-azure text-sm font-medium mb-2">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.current ? 'text' : 'password'}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            className="w-full px-3 py-3 sm:py-2 pr-12 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky text-base sm:text-sm focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure focus:outline-none touch-target"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-skribble-azure hover:text-skribble-sky p-1 touch-target"
                          >
                            {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div>
                        <label className="block text-skribble-azure text-sm font-medium mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.new ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            className="w-full px-3 py-3 sm:py-2 pr-12 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky text-base sm:text-sm focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure focus:outline-none touch-target"
                            placeholder="Enter new password (min 6 characters)"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-skribble-azure hover:text-skribble-sky p-1 touch-target"
                          >
                            {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-skribble-azure text-sm font-medium mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            className="w-full px-3 py-3 sm:py-2 pr-12 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky text-base sm:text-sm focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure focus:outline-none touch-target"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-skribble-azure hover:text-skribble-sky p-1 touch-target"
                          >
                            {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handlePasswordChange}
                        disabled={isSaving}
                        className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium text-base sm:text-sm touch-target"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Changing...
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            Change Password
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Export Data Section */}
                  <div className="bg-skribble-plum/20 p-4 sm:p-6 rounded-lg border border-skribble-azure/20">
                    <h4 className="text-skribble-sky font-medium mb-4 flex items-center gap-2">
                      <Download className="w-5 h-5" />
                      Export Your Data
                    </h4>
                    <p className="text-skribble-azure/70 text-sm mb-4">
                      Download a copy of all your data including projects, collaborations, and annotations.
                    </p>
                    <button
                      onClick={handleDataExport}
                      className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors flex items-center justify-center gap-2 font-medium text-base sm:text-sm touch-target"
                    >
                      <Download className="w-4 h-4" />
                      Export Data
                    </button>
                  </div>

                  {/* Delete Account Section */}
                  <div className="bg-red-500/10 p-4 sm:p-6 rounded-lg border border-red-400/20">
                    <h4 className="text-red-400 font-medium mb-4 flex items-center gap-2">
                      <Trash2 className="w-5 h-5" />
                      Delete Account
                    </h4>
                    <p className="text-red-400/70 text-sm mb-4">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <button
                      onClick={handleDeleteAccount}
                      className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 font-medium text-base sm:text-sm touch-target"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                  </div>
                </div>
              )}

              {/* Referrals Tab - Mobile Optimized */}
              {activeTab === 'referrals' && (
                <div className="space-y-6">
                  <h3 className="font-madimi text-lg sm:text-xl text-skribble-sky mb-4 hidden sm:block">
                    Referral Program
                  </h3>
                  <ReferralDashboard />
                </div>
              )}

              {/* Subscription Tab - Mobile Optimized */}
              {activeTab === 'subscription' && (
                <div className="space-y-6">
                  <h3 className="font-madimi text-lg sm:text-xl text-skribble-sky mb-4 hidden sm:block">
                    Subscription
                  </h3>
                  
                  {/* Current Plan */}
                  <div className="bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                      <Crown className={`w-6 h-6 ${getSubscriptionColor(user.subscriptionTier)}`} />
                      <h4 className="font-medium text-skribble-sky">
                        Current Plan: {user.subscriptionTier.charAt(0).toUpperCase() + user.subscriptionTier.slice(1).replace('_', ' ')}
                      </h4>
                      {subscriptionInfo?.status && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          subscriptionInfo.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          subscriptionInfo.status === 'trialing' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {subscriptionInfo.status}
                        </span>
                      )}
                    </div>
                    
                    {/* Features */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {getSubscriptionFeatures(user.subscriptionTier).map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-skribble-azure text-sm">
                          <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                          {feature}
                        </div>
                      ))}
                    </div>

                    {/* Billing Info */}
                    {subscriptionInfo && (
                      <div className="border-t border-skribble-azure/20 pt-4 mt-4 space-y-3">
                        {subscriptionInfo.currentPeriodEnd && (
                          <p className="text-skribble-azure text-sm flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {subscriptionInfo.cancelAtPeriodEnd 
                              ? `Cancels on ${new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()}`
                              : `Renews on ${new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()}`
                            }
                          </p>
                        )}
                        
                        {subscriptionInfo.trialEnd && (
                          <p className="text-blue-400 text-sm flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Trial ends on {new Date(subscriptionInfo.trialEnd).toLocaleDateString()}
                          </p>
                        )}

                        {subscriptionInfo.paymentMethod && (
                          <p className="text-skribble-azure text-sm flex items-center gap-2">
                            <CreditCardIcon className="w-4 h-4" />
                            {subscriptionInfo.paymentMethod.type} ending in {subscriptionInfo.paymentMethod.last4}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                      {user.subscriptionTier !== 'free' && (
                        <button
                          onClick={handleManageSubscription}
                          className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors font-medium text-base sm:text-sm touch-target flex items-center justify-center gap-2"
                        >
                          <CreditCard className="w-4 h-4" />
                          Manage Billing
                        </button>
                      )}
                      
                      <button
                        onClick={() => window.location.href = '/pricing'}
                        className="w-full sm:w-auto px-4 py-3 sm:py-2 border border-skribble-azure text-skribble-azure rounded-lg hover:bg-skribble-azure hover:text-white transition-colors font-medium text-base sm:text-sm touch-target flex items-center justify-center gap-2"
                      >
                        {user.subscriptionTier === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab - Mobile Optimized */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h3 className="font-madimi text-lg sm:text-xl text-skribble-sky mb-4 hidden sm:block">
                    Notification Preferences
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Email Notifications */}
                    <div className="bg-skribble-plum/20 rounded-lg p-4 sm:p-6">
                      <h4 className="text-skribble-sky font-medium mb-3 flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        Email Notifications
                      </h4>
                      <div className="space-y-4">
                        {[
                          { key: 'collaborations', label: 'New collaboration invites', desc: 'When someone invites you to collaborate' },
                          { key: 'projects', label: 'Project updates', desc: 'When there are new comments or changes to your projects' },
                          { key: 'weekly', label: 'Weekly digest', desc: 'Summary of your activity and pending tasks' },
                          { key: 'marketing', label: 'Product updates', desc: 'New features and platform announcements' }
                        ].map(({ key, label, desc }) => (
                          <div key={key} className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-skribble-azure font-medium text-sm sm:text-base">{label}</p>
                              <p className="text-skribble-azure/70 text-xs sm:text-sm">{desc}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={notificationSettings[key as keyof NotificationSettings]}
                                onChange={(e) => setNotificationSettings({
                                  ...notificationSettings,
                                  [key]: e.target.checked
                                })}
                                className="sr-only peer"
                              />
                              <div className="w-12 h-6 bg-skribble-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Push Notifications */}
                    <div className="bg-skribble-plum/20 rounded-lg p-4 sm:p-6">
                      <h4 className="text-skribble-sky font-medium mb-3 flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        Browser Notifications
                      </h4>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-skribble-azure font-medium text-sm sm:text-base">Enable push notifications</p>
                          <p className="text-skribble-azure/70 text-xs sm:text-sm">Get instant notifications in your browser</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={notificationSettings.push}
                            onChange={(e) => setNotificationSettings({
                              ...notificationSettings,
                              push: e.target.checked
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-12 h-6 bg-skribble-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="sticky bottom-0 sm:relative bg-skribble-dark sm:bg-transparent pt-4 sm:pt-0 pb-safe sm:pb-0 -mx-4 sm:mx-0 px-4 sm:px-0 border-t sm:border-t-0 border-skribble-azure/20 sm:border-0">
                    <button
                      onClick={handleNotificationSave}
                      disabled={isSaving}
                      className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50 font-medium text-base sm:text-sm touch-target flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Settings
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Privacy Tab - Mobile Optimized */}
              {activeTab === 'privacy' && (
                <div className="space-y-6">
                  <h3 className="font-madimi text-lg sm:text-xl text-skribble-sky mb-4 hidden sm:block">
                    Privacy Settings
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Profile Visibility */}
                    <div className="bg-skribble-plum/20 rounded-lg p-4 sm:p-6">
                      <h4 className="text-skribble-sky font-medium mb-3 flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Profile Visibility
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-skribble-azure text-sm font-medium mb-2">
                            Who can see your profile?
                          </label>
                          <select
                            value={privacySettings.profileVisibility}
                            onChange={(e) => setPrivacySettings({
                              ...privacySettings,
                              profileVisibility: e.target.value as 'public' | 'private'
                            })}
                            className="w-full px-3 py-3 sm:py-2 bg-skribble-dark border border-skribble-azure/20 rounded-lg text-skribble-sky text-base sm:text-sm focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure focus:outline-none touch-target"
                          >
                            <option value="public">Public - Anyone can see your profile</option>
                            <option value="private">Private - Only collaborators can see your profile</option>
                          </select>
                        </div>

                        {[
                          { key: 'showEmail', label: 'Show email in profile', desc: 'Allow others to see your email address' },
                          { key: 'allowDirectMessages', label: 'Allow direct messages', desc: 'Let other users send you direct messages' },
                          { key: 'indexInSearch', label: 'Include in search results', desc: 'Allow your profile to appear in search results' }
                        ].map(({ key, label, desc }) => (
                          <div key={key} className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-skribble-azure font-medium text-sm sm:text-base">{label}</p>
                              <p className="text-skribble-azure/70 text-xs sm:text-sm">{desc}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={privacySettings[key as keyof PrivacySettings]}
                                onChange={(e) => setPrivacySettings({
                                  ...privacySettings,
                                  [key]: e.target.checked
                                })}
                                className="sr-only peer"
                              />
                              <div className="w-12 h-6 bg-skribble-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="sticky bottom-0 sm:relative bg-skribble-dark sm:bg-transparent pt-4 sm:pt-0 pb-safe sm:pb-0 -mx-4 sm:mx-0 px-4 sm:px-0 border-t sm:border-t-0 border-skribble-azure/20 sm:border-0">
                    <button
                      onClick={handlePrivacySave}
                      disabled={isSaving}
                      className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50 font-medium text-base sm:text-sm touch-target flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Settings
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

