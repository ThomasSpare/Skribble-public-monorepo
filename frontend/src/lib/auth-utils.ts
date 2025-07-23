// frontend/src/lib/auth-utils.ts
// Utilities to handle guest user authentication

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  subscriptionTier: string;
  subscriptionStatus?: string;
  temporaryAccess?: boolean;
  trialEndDate?: string;
  isGuest?: boolean;
  profileImage?: string;
  guestExpiresAt?: string; // ISO date string for guest expiration
}

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  
  const userStr = localStorage.getItem('skribble_user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Error parsing stored user:', error);
    }
  }
  return null;
};

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // Check both possible token keys (prioritize skribble_token)
  const skribbleToken = localStorage.getItem('skribble_token');
  const fallbackToken = localStorage.getItem('token');
  
  console.log('🔍 Auth Debug - Token check:', {
    skribbleToken: skribbleToken ? 'present' : 'missing',
    fallbackToken: fallbackToken ? 'present' : 'missing'
  });
  
  return skribbleToken || fallbackToken;
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};


//Enhanced voice note permission check for guests
export const canCreateVoiceNotes = (user: User | null): boolean => {
  if (!user) return false;
  
  console.log('🔍 Checking voice note permissions:', {
    userEmail: user.email,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    isGuest: user.isGuest,
    guestExpiresAt: user.guestExpiresAt
  });
  
  // Allow voice notes for authenticated users with proper roles
  const allowedRoles = ['admin', 'producer', 'artist'];
  const allowedTiers = ['indie', 'producer', 'studio', 'artist_guest'];
  
  const hasValidRole = allowedRoles.includes(user.role);
  const hasValidTier = allowedTiers.includes(user.subscriptionTier);
  
  // Special handling for guest users
  if (user.isGuest || user.subscriptionTier === 'artist_guest') {
    // Check if guest account is still valid
    if (user.guestExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(user.guestExpiresAt);
      
      if (now > expiresAt) {
        console.warn('🚫 Guest account expired, voice notes disabled');
        return false;
      }
    }
    
    // Guest users need artist role AND artist_guest tier
    return user.role === 'artist' && user.subscriptionTier === 'artist_guest';
  }
  
  return hasValidRole && hasValidTier;
};

// Fetch user info from backend if not in localStorage
export const fetchUserInfo = async (): Promise<User | null> => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    if (data.success && data.data) {
      // Store user info for future use
      localStorage.setItem('skribble_user', JSON.stringify(data.data));
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
  }

  return null;
};

// Get user info - from localStorage or fetch from backend
export const getCurrentUser = async (): Promise<User | null> => {
  // First try localStorage
  let user = getStoredUser();
  if (user) return user;

  // If not in localStorage, fetch from backend
  user = await fetchUserInfo();
  return user;
};

export const logout = () => {
  localStorage.removeItem('skribble_token');
  localStorage.removeItem('token');
  localStorage.removeItem('skribble_user');
  window.location.href = '/';
};