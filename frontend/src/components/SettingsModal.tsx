// frontend/src/components/SettingsModal.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Camera, 
  Save, 
  Loader2,
  Users,
  Gift,
  Copy,
  Check,
  Share2,
  Crown,
  CreditCard,
  Bell,
  Shield,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  DollarSign,
  Calendar,
  CreditCard as CreditCardIcon
} from 'lucide-react';
import Image from 'next/image';
import ReferralDashboard from './ReferralDashboard';

interface User {
  id: string;
  email: string;
  username: string;
  role: 'producer' | 'artist' | 'both';
  subscriptionTier: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

interface SettingsModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: User) => void;
}

type SettingsTab = 'profile' | 'referrals' | 'subscription' | 'notifications' | 'privacy';

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
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: {
    type: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
}

export default function SettingsModal({ user, isOpen, onClose, onUserUpdate }: SettingsModalProps) {
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
      const token = localStorage.getItem('skribble_token');
      
      // Load notification settings
      const notifResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/notification-settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (notifResponse.ok) {
        const notifData = await notifResponse.json();
        if (notifData.success) {
          setNotificationSettings(notifData.data);
        }
      }

      // Load privacy settings
      const privacyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/privacy-settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (privacyResponse.ok) {
        const privacyData = await privacyResponse.json();
        if (privacyData.success) {
          setPrivacySettings(privacyData.data);
        }
      }

      // Load subscription info
      const subResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/subscription`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (subResponse.ok) {
        const subData = await subResponse.json();
        if (subData.success) {
          setSubscriptionInfo(subData.data);
        }
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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
      const token = localStorage.getItem('skribble_token');
      const formData = new FormData();
      
      formData.append('username', profileData.username);
      formData.append('email', profileData.email);
      formData.append('role', profileData.role);
      
      if (selectedFile) {
        formData.append('profileImage', selectedFile);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        onUserUpdate(data.data);
        setSuccess('Profile updated successfully!');
        setSelectedFile(null);
        setPreviewImage(null);
      } else {
        throw new Error(data.error?.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      setError(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/notification-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationSettings)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Notification settings updated!');
      } else {
        throw new Error(data.error?.message || 'Failed to update settings');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update notification settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrivacySave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/privacy-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(privacySettings)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Privacy settings updated!');
      } else {
        throw new Error(data.error?.message || 'Failed to update settings');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update privacy settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.')) {
      return;
    }

    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/subscription/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Subscription cancelled successfully');
        loadUserSettings(); // Reload subscription info
      } else {
        throw new Error(data.error?.message || 'Failed to cancel subscription');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to cancel subscription');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = prompt('This action cannot be undone. Type "DELETE" to confirm:');
    if (confirmation !== 'DELETE') return;

    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        localStorage.clear();
        window.location.href = '/';
      } else {
        throw new Error('Failed to delete account');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete account');
    }
  };

  const getSubscriptionColor = (tier: string) => {
    const colors: { [key: string]: string } = {
      'free': 'text-skribble-azure',
      'indie': 'text-blue-400',
      'producer': 'text-purple-400',
      'studio': 'text-yellow-400'
    };
    return colors[tier] || 'text-skribble-azure';
  };

  const getSubscriptionFeatures = (tier: string) => {
    const features: { [key: string]: string[] } = {
      'free': ['1 project', '1 collaborator', '25MB files'],
      'indie': ['5 projects', '2 collaborators', '50MB files', 'Basic exports'],
      'producer': ['25 projects', '10 collaborators', '200MB files', 'All exports', 'Voice notes'],
      'studio': ['Unlimited projects', 'Unlimited collaborators', '1GB files', 'White-label', 'Analytics']
    };
    return features[tier] || features['free'];
  };

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'referrals' as SettingsTab, label: 'Referrals', icon: Users },
    { id: 'subscription' as SettingsTab, label: 'Subscription', icon: Crown },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
    { id: 'privacy' as SettingsTab, label: 'Privacy', icon: Shield }
  ];

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
                        ? 'bg-skribble-azure text-white'
                        : 'text-skribble-azure hover:bg-skribble-plum/30'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {/* Messages */}
            {error && (
              <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-200">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-500/20 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <p className="text-green-200">{success}</p>
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-madimi text-xl text-skribble-sky mb-4">Profile Information</h3>
                  
                  {/* Profile Image Upload */}
                  <div className="mb-6">
                    <label className="block text-skribble-azure text-sm mb-3">Profile Image</label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-skribble-plum/30 border-2 border-skribble-azure/20">
                          {previewImage || profileData.profileImage ? (
                            <Image 
                              src={previewImage || profileData.profileImage} 
                              alt="Profile" 
                              width={80} 
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-skribble-azure to-skribble-purple">
                              <span className="text-white text-xl font-medium">
                                {profileData.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 bg-skribble-azure rounded-full p-2 shadow-lg hover:bg-skribble-azure/80 transition-colors"
                        >
                          <Camera className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      <div>
                        <p className="text-skribble-sky font-medium">{profileData.username}</p>
                        <p className="text-skribble-azure text-sm">Click the camera icon to change</p>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-skribble-azure text-sm mb-2">Username</label>
                      <input
                        type="text"
                        value={profileData.username}
                        onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full px-4 py-3 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky placeholder-skribble-azure/50 focus:outline-none focus:border-skribble-azure transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-skribble-azure text-sm mb-2">Email</label>
                      <input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky placeholder-skribble-azure/50 focus:outline-none focus:border-skribble-azure transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-skribble-azure text-sm mb-2">Role</label>
                      <select
                        value={profileData.role}
                        onChange={(e) => setProfileData(prev => ({ ...prev, role: e.target.value as any }))}
                        className="w-full px-4 py-3 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky focus:outline-none focus:border-skribble-azure transition-colors"
                      >
                        <option value="producer">Producer</option>
                        <option value="artist">Artist</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleProfileSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-skribble-azure text-white px-6 py-3 rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50"
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
                      Current Plan: {user.subscriptionTier.charAt(0).toUpperCase() + user.subscriptionTier.slice(1)}
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
                          {subscriptionInfo.cancelAtPeriodEnd ? 'Expires' : 'Renews'} on{' '}
                          {new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()}
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
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6">
                    {user.subscriptionTier === 'free' ? (
                      <button className="flex items-center gap-2 bg-skribble-azure text-white px-4 py-2 rounded-lg hover:bg-skribble-azure/80 transition-colors">
                        <Crown className="w-4 h-4" />
                        Upgrade Plan
                      </button>
                    ) : (
                      <>
                        <button className="flex items-center gap-2 bg-skribble-azure text-white px-4 py-2 rounded-lg hover:bg-skribble-azure/80 transition-colors">
                          <Crown className="w-4 h-4" />
                          Change Plan
                        </button>
                        <button className="flex items-center gap-2 border border-skribble-azure text-skribble-azure px-4 py-2 rounded-lg hover:bg-skribble-azure hover:text-white transition-colors">
                          <CreditCard className="w-4 h-4" />
                          Billing Portal
                        </button>
                        {!subscriptionInfo?.cancelAtPeriodEnd && (
                          <button 
                            onClick={handleCancelSubscription}
                            className="flex items-center gap-2 border border-red-400 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Usage Statistics */}
                <div className="bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg p-6">
                  <h4 className="font-medium text-skribble-sky mb-4">Current Usage</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-skribble-azure">Projects</span>
                        <span className="text-skribble-sky">5 / 25</span>
                      </div>
                      <div className="w-full bg-skribble-dark rounded-full h-2">
                        <div className="bg-skribble-azure h-2 rounded-full" style={{ width: '20%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-skribble-azure">Storage</span>
                        <span className="text-skribble-sky">45MB / 200MB</span>
                      </div>
                      <div className="w-full bg-skribble-dark rounded-full h-2">
                        <div className="bg-skribble-azure h-2 rounded-full" style={{ width: '22.5%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Notification Preferences</h3>
                
                {/* Email Notifications */}
                <div className="bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg p-6">
                  <h4 className="font-medium text-skribble-sky mb-4 flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Email Notifications
                  </h4>
                  <div className="space-y-4">
                    {[
                      { key: 'collaborations' as keyof NotificationSettings, label: 'New collaboration invites', description: 'When someone invites you to collaborate on a project' },
                      { key: 'projects' as keyof NotificationSettings, label: 'Project updates and annotations', description: 'Comments, feedback, and project changes' },
                      { key: 'weekly' as keyof NotificationSettings, label: 'Weekly summary emails', description: 'A digest of your project activity' },
                      { key: 'marketing' as keyof NotificationSettings, label: 'Marketing emails', description: 'Product updates and promotional content' }
                    ].map((notif) => (
                      <div key={notif.key} className="flex items-start justify-between py-3 border-b border-skribble-azure/10 last:border-b-0">
                        <div className="flex-1">
                          <span className="text-skribble-sky font-medium">{notif.label}</span>
                          <p className="text-skribble-azure/70 text-sm mt-1">{notif.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input 
                            type="checkbox" 
                            checked={notificationSettings[notif.key]}
                            onChange={(e) => setNotificationSettings(prev => ({ ...prev, [notif.key]: e.target.checked }))}
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-skribble-plum peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-skribble-azure/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleNotificationSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-skribble-azure text-white px-6 py-3 rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Preferences
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Privacy & Security</h3>
                
                {/* Account Visibility */}
                <div className="bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg p-6">
                  <h4 className="font-medium text-skribble-sky mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Account Visibility
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-skribble-azure text-sm mb-2">Profile Visibility</label>
                      <select 
                        value={privacySettings.profileVisibility}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, profileVisibility: e.target.value as 'public' | 'private' }))}
                        className="w-full px-3 py-2 bg-skribble-dark border border-skribble-azure/20 rounded text-skribble-sky"
                      >
                        <option value="public">Public - Anyone can find me</option>
                        <option value="private">Private - Only invited collaborators</option>
                      </select>
                      <p className="text-skribble-azure/70 text-sm mt-1">
                        Control who can discover your profile and collaborate with you
                      </p>
                    </div>

                    {[
                      { key: 'showEmail' as keyof PrivacySettings, label: 'Show email in profile', description: 'Allow collaborators to see your email address' },
                      { key: 'allowDirectMessages' as keyof PrivacySettings, label: 'Allow direct messages', description: 'Let other users send you messages' },
                      { key: 'indexInSearch' as keyof PrivacySettings, label: 'Include in search results', description: 'Allow your profile to appear in search results' }
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-start justify-between py-3 border-b border-skribble-azure/10 last:border-b-0">
                        <div className="flex-1">
                          <span className="text-skribble-sky font-medium">{setting.label}</span>
                          <p className="text-skribble-azure/70 text-sm mt-1">{setting.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input 
                            type="checkbox" 
                            checked={typeof privacySettings[setting.key] === 'boolean' ? privacySettings[setting.key] as boolean : false}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrivacySettings((prev: PrivacySettings) => ({ ...prev, [setting.key]: e.target.checked }))}
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-skribble-plum peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-skribble-azure/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handlePrivacySave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-skribble-azure text-white px-6 py-3 rounded-lg hover:bg-skribble-azure/80 transition-colors disabled:opacity-50"
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
                
                {/* Danger Zone */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
                  <h4 className="font-medium text-red-300 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Danger Zone
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-red-200 font-medium mb-2">Delete Account</h5>
                      <p className="text-red-200/70 text-sm mb-4">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                      <button 
                        onClick={handleDeleteAccount}
                        className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </button>
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