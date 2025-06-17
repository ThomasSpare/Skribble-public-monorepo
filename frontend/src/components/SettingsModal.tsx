// frontend/src/components/SettingsModal.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  X, User, Camera, Save, Loader2, Users, Gift, Copy, Check, Share2,
  Crown, CreditCard, Bell, Shield, Mail, AlertCircle, Eye, EyeOff,
  Trash2, ExternalLink, DollarSign, Calendar, CreditCard as CreditCardIcon,
  Settings, LogOut, Download, Upload
} from 'lucide-react';
import Image from 'next/image';
import { auth } from '@/lib/auth';
import ReferralDashboard from './ReferralDashboard';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Reset form when user changes
  useEffect(() => {
    setProfileData({
      username: user.username,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || ''
    });
    setPreviewImage(user.profileImage || null);
    setSelectedFile(null);
  }, [user]);

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUserSettings();
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-skribble-dark border border-skribble-azure/20 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-skribble-azure/20">
          <h2 className="font-madimi text-2xl text-skribble-sky">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-skribble-plum/30 text-skribble-azure transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 p-6 border-r border-skribble-azure/20">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-skribble-azure/20 text-skribble-sky'
                        : 'text-skribble-azure hover:bg-skribble-plum/30'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
              
              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors text-red-400 hover:bg-red-500/20 mt-8 border-t border-skribble-azure/20 pt-4"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Profile Settings</h3>
                
                {/* Profile Image */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-skribble-plum/30 overflow-hidden">
                      {previewImage || profileData.profileImage ? (
                        <Image
                          src={previewImage || profileData.profileImage}
                          alt="Profile"
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-skribble-azure">
                          <User className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-2 bg-skribble-azure rounded-full text-white hover:bg-skribble-azure/80 transition-colors"
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
                  <div>
                    <h4 className="text-skribble-sky font-medium">Profile Photo</h4>
                    <p className="text-skribble-azure/70 text-sm">
                      Upload a photo to personalize your profile
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-skribble-azure text-sm font-medium mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky"
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
                      className="w-full px-3 py-2 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky"
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
                    className="w-full px-3 py-2 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky"
                  >
                    <option value="producer">Producer</option>
                    <option value="artist">Artist</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleProfileSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 inline mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Referrals Tab */}
            {activeTab === 'referrals' && (
              <div>
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Referral Program</h3>
                <ReferralDashboard />
              </div>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && (
              <div className="space-y-6">
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Subscription</h3>
                
                {/* Current Plan */}
                <div className="bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
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
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {getSubscriptionFeatures(user.subscriptionTier).map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-skribble-azure text-sm">
                        <Check className="w-4 h-4 text-green-400" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* Billing Info */}
                  {subscriptionInfo && (
                    <div className="border-t border-skribble-azure/20 pt-4 mt-4 space-y-3">
                      {subscriptionInfo.currentPeriodEnd && (
                        <p className="text-skribble-azure text-sm">
                          <Calendar className="w-4 h-4 inline mr-2" />
                          {subscriptionInfo.cancelAtPeriodEnd 
                            ? `Cancels on ${new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()}`
                            : `Renews on ${new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()}`
                          }
                        </p>
                      )}
                      
                      {subscriptionInfo.trialEnd && (
                        <p className="text-blue-400 text-sm">
                          <Calendar className="w-4 h-4 inline mr-2" />
                          Trial ends on {new Date(subscriptionInfo.trialEnd).toLocaleDateString()}
                        </p>
                      )}

                      {subscriptionInfo.paymentMethod && (
                        <p className="text-skribble-azure text-sm">
                          <CreditCardIcon className="w-4 h-4 inline mr-2" />
                          {subscriptionInfo.paymentMethod.type} ending in {subscriptionInfo.paymentMethod.last4}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 mt-6">
                    {user.subscriptionTier !== 'free' && (
                      <button
                        onClick={handleManageSubscription}
                        className="px-4 py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors"
                      >
                        <CreditCard className="w-4 h-4 inline mr-2" />
                        Manage Billing
                      </button>
                    )}
                    
                    <button
                      onClick={() => window.location.href = '/pricing'}
                      className="px-4 py-2 border border-skribble-azure text-skribble-azure rounded-lg hover:bg-skribble-azure hover:text-white transition-colors"
                    >
                      {user.subscriptionTier === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Notification Preferences</h3>
                
                <div className="space-y-4">
                  {/* Email Notifications */}
                  <div className="bg-skribble-plum/20 rounded-lg p-4">
                    <h4 className="text-skribble-sky font-medium mb-3 flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Email Notifications
                    </h4>
                    <div className="space-y-3">
                      {[
                        { key: 'collaborations', label: 'New collaboration invites', desc: 'When someone invites you to collaborate' },
                        { key: 'projects', label: 'Project updates', desc: 'When there are new comments or changes to your projects' },
                        { key: 'weekly', label: 'Weekly digest', desc: 'Summary of your activity and pending tasks' },
                        { key: 'marketing', label: 'Product updates', desc: 'New features and platform announcements' }
                      ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <p className="text-skribble-azure font-medium">{label}</p>
                            <p className="text-skribble-azure/70 text-sm">{desc}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notificationSettings[key as keyof NotificationSettings]}
                              onChange={(e) => setNotificationSettings({
                                ...notificationSettings,
                                [key]: e.target.checked
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-skribble-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Push Notifications */}
                  <div className="bg-skribble-plum/20 rounded-lg p-4">
                    <h4 className="text-skribble-sky font-medium mb-3 flex items-center gap-2">
                      <Bell className="w-5 h-5" />
                      Browser Notifications
                    </h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-skribble-azure font-medium">Enable push notifications</p>
                        <p className="text-skribble-azure/70 text-sm">Get instant notifications in your browser</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.push}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            push: e.target.checked
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-skribble-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleNotificationSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 inline mr-2" />
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Privacy Settings</h3>
                
                <div className="space-y-4">
                  {/* Profile Visibility */}
                  <div className="bg-skribble-plum/20 rounded-lg p-4">
                    <h4 className="text-skribble-sky font-medium mb-3 flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Profile Visibility
                    </h4>
                    <div className="space-y-3">
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
                          className="w-full px-3 py-2 bg-skribble-dark border border-skribble-azure/20 rounded-lg text-skribble-sky"
                        >
                          <option value="public">Public - Anyone can see your profile</option>
                          <option value="private">Private - Only collaborators can see your profile</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-skribble-azure font-medium">Show email in profile</p>
                          <p className="text-skribble-azure/70 text-sm">Allow others to see your email address</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={privacySettings.showEmail}
                            onChange={(e) => setPrivacySettings({
                              ...privacySettings,
                              showEmail: e.target.checked
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-skribble-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-skribble-azure font-medium">Allow direct messages</p>
                          <p className="text-skribble-azure/70 text-sm">Let other users send you direct messages</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={privacySettings.allowDirectMessages}
                            onChange={(e) => setPrivacySettings({
                              ...privacySettings,
                              allowDirectMessages: e.target.checked
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-skribble-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-skribble-azure font-medium">Include in search results</p>
                          <p className="text-skribble-azure/70 text-sm">Allow your profile to appear in search results</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={privacySettings.indexInSearch}
                            onChange={(e) => setPrivacySettings({
                              ...privacySettings,
                              indexInSearch: e.target.checked
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-skribble-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handlePrivacySave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 inline mr-2" />
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Data & Security Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Data & Security</h3>
                
                <div className="space-y-4">
                  {/* Data Export */}
                  <div className="bg-skribble-plum/20 rounded-lg p-4">
                    <h4 className="text-skribble-sky font-medium mb-3 flex items-center gap-2">
                      <Download className="w-5 h-5" />
                      Export Your Data
                    </h4>
                    <p className="text-skribble-azure/70 text-sm mb-4">
                      Download a copy of all your data including projects, collaborations, and settings.
                    </p>
                    <button
                      onClick={handleDataExport}
                      className="px-4 py-2 bg-skribble-azure text-white rounded-lg hover:bg-skribble-azure/80 transition-colors"
                    >
                      <Download className="w-4 h-4 inline mr-2" />
                      Export Data
                    </button>
                  </div>

                  {/* Account Security */}
                  <div className="bg-skribble-plum/20 rounded-lg p-4">
                    <h4 className="text-skribble-sky font-medium mb-3 flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Account Security
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-skribble-azure font-medium">Two-Factor Authentication</p>
                          <p className="text-skribble-azure/70 text-sm">Add an extra layer of security to your account</p>
                        </div>
                        <button className="px-3 py-1 text-sm border border-skribble-azure text-skribble-azure rounded hover:bg-skribble-azure hover:text-white transition-colors">
                          Enable
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-skribble-azure font-medium">Change Password</p>
                          <p className="text-skribble-azure/70 text-sm">Update your account password</p>
                        </div>
                        <button className="px-3 py-1 text-sm border border-skribble-azure text-skribble-azure rounded hover:bg-skribble-azure hover:text-white transition-colors">
                          Change
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <h4 className="text-red-400 font-medium mb-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Danger Zone
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-red-400 font-medium">Delete Account</p>
                          <p className="text-red-400/70 text-sm">Permanently delete your account and all data</p>
                        </div>
                        <button
                          onClick={handleDeleteAccount}
                          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}