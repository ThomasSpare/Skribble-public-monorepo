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
  AlertCircle
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

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (): Promise<string | null> => {
        if (!selectedFile) return null;

        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('type', 'profile');

        try {
            const token = localStorage.getItem('skribble_token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
            });

            const data = await response.json();
            
            if (data.success) {
            // Convert full URL to relative path for storage
            const url = data.data.url;
            const relativePath = url.includes('/images/') 
                ? url.substring(url.indexOf('/images/'))
                : url;
            
            console.log('✅ Image uploaded, storing as:', relativePath);
            return relativePath;
            } else {
            throw new Error(data.error?.message || 'Failed to upload image');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            throw error;
        }
        };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      let imageUrl = profileData.profileImage;
      
      // Upload new image if selected
      if (selectedFile) {
        const uploadedImage = await uploadImage();
        imageUrl = uploadedImage || profileData.profileImage;
      }

      // Update user profile
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: profileData.username,
          role: profileData.role,
          profileImage: imageUrl
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const updatedUser = { ...user, ...data.data };
        onUserUpdate(updatedUser);
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
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-8 h-8 text-skribble-azure" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute -bottom-2 -right-2 w-8 h-8 bg-skribble-azure text-white rounded-full flex items-center justify-center hover:bg-skribble-azure/80 transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <p className="text-skribble-azure text-sm mb-1">
                          Click the camera icon to upload a new image
                        </p>
                        <p className="text-skribble-purple text-xs">
                          Max size: 5MB. Supported formats: JPG, PNG, WebP
                        </p>
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

                  {/* Username */}
                  <div className="mb-4">
                    <label className="block text-skribble-azure text-sm mb-2">Username</label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full px-4 py-3 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky focus:border-skribble-azure focus:outline-none"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div className="mb-4">
                    <label className="block text-skribble-azure text-sm mb-2">Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      readOnly
                      className="w-full px-4 py-3 bg-skribble-plum/20 border border-skribble-azure/10 rounded-lg text-skribble-purple cursor-not-allowed"
                    />
                    <p className="text-skribble-purple text-xs mt-1">
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>

                  {/* Role */}
                  <div className="mb-6">
                    <label className="block text-skribble-azure text-sm mb-2">Role</label>
                    <select
                      value={profileData.role}
                      onChange={(e) => setProfileData(prev => ({ ...prev, role: e.target.value as any }))}
                      className="w-full px-4 py-3 bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg text-skribble-sky focus:border-skribble-azure focus:outline-none"
                    >
                      <option value="producer">Producer</option>
                      <option value="artist">Artist</option>
                      <option value="both">Both Producer & Artist</option>
                    </select>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
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
                
                <div className="bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Crown className="w-6 h-6 text-skribble-azure" />
                    <h4 className="font-medium text-skribble-sky">
                      Current Plan: {user.subscriptionTier.charAt(0).toUpperCase() + user.subscriptionTier.slice(1)}
                    </h4>
                  </div>
                  
                  <p className="text-skribble-azure mb-4">
                    Manage your subscription, billing, and payment methods.
                  </p>
                  
                  <div className="space-y-3">
                    <button className="w-full bg-skribble-azure text-white px-4 py-2 rounded-lg hover:bg-skribble-azure/80 transition-colors">
                      Upgrade Plan
                    </button>
                    <button className="w-full border border-skribble-azure text-skribble-azure px-4 py-2 rounded-lg hover:bg-skribble-azure hover:text-white transition-colors">
                      Manage Billing
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
                  {[
                    { label: 'New collaboration invites', key: 'collaborations' },
                    { label: 'Project updates and annotations', key: 'projects' },
                    { label: 'Weekly summary emails', key: 'weekly' },
                    { label: 'Marketing emails', key: 'marketing' }
                  ].map((notif) => (
                    <div key={notif.key} className="flex items-center justify-between py-3 border-b border-skribble-azure/10">
                      <span className="text-skribble-azure">{notif.label}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-skribble-plum peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-skribble-azure/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-skribble-azure"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <h3 className="font-madimi text-xl text-skribble-sky mb-4">Privacy & Security</h3>
                
                <div className="space-y-4">
                  <div className="bg-skribble-plum/30 border border-skribble-azure/20 rounded-lg p-4">
                    <h4 className="font-medium text-skribble-sky mb-2">Account Visibility</h4>
                    <p className="text-skribble-azure text-sm mb-3">
                      Control who can find and collaborate with you
                    </p>
                    <select className="w-full px-3 py-2 bg-skribble-dark border border-skribble-azure/20 rounded text-skribble-sky">
                      <option>Public - Anyone can find me</option>
                      <option>Private - Only invited collaborators</option>
                    </select>
                  </div>
                  
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <h4 className="font-medium text-red-300 mb-2">Danger Zone</h4>
                    <p className="text-red-200 text-sm mb-3">
                      Permanently delete your account and all associated data
                    </p>
                    <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                      Delete Account
                    </button>
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