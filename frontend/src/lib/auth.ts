export const AUTH_TOKEN_KEY = 'skribble_token';
export const REFRESH_TOKEN_KEY = 'skribble_refresh_token';

export const auth = {
  setTokens(token: string, refreshToken: string) {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      console.error('Failed to store auth tokens:', error);
      throw error;
    }
  },

  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  clear() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  isAuthenticated() {
    return !!this.getToken();
  }
};