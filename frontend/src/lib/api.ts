// frontend/src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  role: 'producer' | 'artist' | 'both';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'producer' | 'artist' | 'both';
  subscriptionTier: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
  };
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

class APIClient {
  private getHeaders(includeAuth = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('skribble_token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: {
          message: 'Network error occurred',
          code: 'NETWORK_ERROR'
        }
      };
    }
  }

  async login(credentials: LoginData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: {
          message: 'Network error occurred',
          code: 'NETWORK_ERROR'
        }
      };
    }
  }

  async refreshToken(): Promise<AuthResponse> {
    try {
      const refreshToken = localStorage.getItem('skribble_refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: {
          message: 'Failed to refresh token',
          code: 'REFRESH_ERROR'
        }
      };
    }
  }



  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE.replace('/api', '')}/health`);
      return await response.json();
    } catch (error) {
      return { status: 'Error', message: 'Cannot connect to server' };
    }
  }
}

export const apiClient = new APIClient();