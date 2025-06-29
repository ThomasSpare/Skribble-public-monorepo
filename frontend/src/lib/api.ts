// frontend/src/lib/api.ts - UPDATED WITH REFERRAL SUPPORT
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Types
export interface RegisterData {
  email: string;
  username: string;
  password: string;
  role: 'producer' | 'artist' | 'both';
  tier?: string;
  referralCode?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'producer' | 'artist' | 'both';
  subscriptionTier: string;
  subscriptionStatus?: string;
  profileImage?: string;
  referralCode?: string;
  referredBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  requiresPayment?: boolean;
  message?: string;
}

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('skribble_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Helper function to handle API responses
const handleResponse = async <T = any>(response: Response): Promise<ApiResponse<T>> => {
  try {
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: {
          message: data.error?.message || 'An error occurred',
          code: data.error?.code,
          details: data.error?.details
        }
      };
    }
    
    return {
      success: true,
      data: data.data || data
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Failed to parse response',
        code: 'PARSE_ERROR'
      }
    };
  }
};

export const apiClient = {
  // Authentication
  async register(data: RegisterData): Promise<ApiResponse<AuthResponse>> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    return handleResponse<AuthResponse>(response);
  },

  async login(data: LoginData): Promise<ApiResponse<AuthResponse>> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    return handleResponse<AuthResponse>(response);
  },

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    
    return handleResponse<User>(response);
  },

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ token: string; user: User }>> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    return handleResponse(response);
  },

  // Referral System
  async generateReferralCode(): Promise<ApiResponse<{ referralCode: string }>> {
    const response = await fetch(`${API_BASE_URL}/users-s3/generate-referral-code`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    return handleResponse(response);
  },

  async getReferralStats(): Promise<ApiResponse<{
    referral_code: string | null;
    successful_referrals: number;
    pending_referrals: number;
    rewards_earned: number;
  }>> {
    const response = await fetch(`${API_BASE_URL}/users-s3/referral-stats`, {
      headers: getAuthHeaders(),
    });
    
    return handleResponse(response);
  },

  async getReferralHistory(): Promise<ApiResponse<Array<{
    id: string;
    username: string;
    email: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    createdAt: string;
    rewardEarned: boolean;
  }>>> {
    const response = await fetch(`${API_BASE_URL}/users-s3/referral-history`, {
      headers: getAuthHeaders(),
    });
    
    return handleResponse(response);
  },

  // User Management
  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await fetch(`${API_BASE_URL}/users-s3/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    
    return handleResponse<User>(response);
  },

  // Subscription Management
  async getSubscriptionInfo(): Promise<ApiResponse<{
    tier: string;
    status: string;
    trialEnd?: string;
    hasStripeSubscription: boolean;
  }>> {
    const response = await fetch(`${API_BASE_URL}/users-s3/subscription`, {
      headers: getAuthHeaders(),
    });
    
    return handleResponse(response);
  },

  // Projects (basic endpoints)
  async getProjects(): Promise<ApiResponse<any[]>> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      headers: getAuthHeaders(),
    });
    
    return handleResponse(response);
  },

  async getProject(id: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      headers: getAuthHeaders(),
    });
    
    return handleResponse(response);
  }
};

// Utility functions
export const isLoggedIn = (): boolean => {
  return !!(localStorage.getItem('skribble_token') || localStorage.getItem('token'));
};

export const logout = (): void => {
  localStorage.removeItem('skribble_token');
  localStorage.removeItem('skribble_refresh_token');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
};

export const getStoredToken = (): string | null => {
  return localStorage.getItem('skribble_token') || localStorage.getItem('token');
};