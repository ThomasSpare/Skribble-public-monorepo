// frontend/src/components/UserAvatar.tsx
'use client';
import React from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import { getImageUrl, getDefaultAvatar } from '@/utils/images';

interface UserAvatarProps {
  user: {
    username: string;
    profileImage?: string;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallbackIcon?: boolean; // Whether to show User icon or just colored background
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm', 
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-20 h-20 text-xl'
};

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5', 
  lg: 'w-8 h-8',
  xl: 'w-10 h-10'
};

// test

export default function UserAvatar({ 
  user, 
  size = 'md', 
  className = '',
  showFallbackIcon = true 
}: UserAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const avatarBgColor = getDefaultAvatar(user.username);
  const sizeClass = sizeClasses[size];
  const iconSize = iconSizes[size];

  // If we have a profile image and it hasn't errored, show it
  if (user.profileImage && !imageError) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
        <Image
          src={getImageUrl(user.profileImage)}
          alt={`${user.username}'s avatar`}
          width={size === 'xl' ? 80 : size === 'lg' ? 64 : size === 'md' ? 40 : size === 'sm' ? 32 : 24}
          height={size === 'xl' ? 80 : size === 'lg' ? 64 : size === 'md' ? 40 : size === 'sm' ? 32 : 24}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

    return (
    <div className={`${sizeClass} rounded-full ${avatarBgColor} flex items-center justify-center flex-shrink-0 ${className}`}>
      {showFallbackIcon ? (
        <User className={`${iconSize} text-white`} />
      ) : (
        <span className="font-semibold text-white">
          {user.username.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}