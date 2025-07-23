// frontend/src/lib/api-config.ts
// Centralized API configuration to prevent URL issues

// Get the base API URL (already includes /api)
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Build API endpoint URL
 * @param endpoint - The endpoint path (without /api prefix)
 * @example
 * buildApiUrl('auth/login') // Returns: http://localhost:5000/api/auth/login
 * buildApiUrl('/collaboration/join/123') // Returns: http://localhost:5000/api/collaboration/join/123
 */
export function buildApiUrl(endpoint: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // Ensure API_BASE_URL doesn't end with slash and endpoint doesn't start with slash
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  
  return `${baseUrl}/${cleanEndpoint}`;
}

/**
 * Get auth headers with token
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('skribble_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

/**
 * Get auth headers for guest invites
 */
export function getGuestAuthHeaders(): Record<string, string> {
  return {
    ...getAuthHeaders(),
    'X-Guest-Invite': 'true'
  };
}

/**
 * Handle API response consistently
 */
export async function handleApiResponse<T = any>(response: Response): Promise<{
  success: boolean;
  data?: T;
  error?: { message: string; code?: string; details?: any };
}> {
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
}