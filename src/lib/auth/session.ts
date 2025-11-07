/**
 * Authentication session management
 */

import { encryptFile, decryptFile } from '../crypto/encryption.js';

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  email_verified: boolean;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  salt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication session manager
 */
export class AuthSession {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: UserProfile | null = null;
  private password: string | null = null; // Stored in memory only for encryption
  private apiUrl: string;

  constructor(apiUrl: string = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
    this.loadSession();
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string): Promise<UserProfile> {
    const response = await fetch(`${this.apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.user = data.user;
    this.password = password;

    this.persistSession();

    return data.user;
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<UserProfile> {
    const response = await fetch(`${this.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.user = data.user;
    this.password = password;

    this.persistSession();

    return data.user;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    if (this.refreshToken) {
      try {
        await fetch(`${this.apiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    this.clearSession();
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!response.ok) {
      this.clearSession();
      throw new Error('Session expired. Please login again.');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;

    this.persistSession();
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    const response = await this.authenticatedFetch('/api/auth/profile');

    if (!response.ok) {
      throw new Error('Failed to get profile');
    }

    const data = await response.json();
    this.user = data.user;
    return data.user;
  }

  /**
   * Delete account
   */
  async deleteAccount(): Promise<void> {
    const response = await this.authenticatedFetch('/api/auth/account', {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete account');
    }

    this.clearSession();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && this.user !== null;
  }

  /**
   * Get current user
   */
  getUser(): UserProfile | null {
    return this.user;
  }

  /**
   * Get password (for encryption only)
   */
  getPassword(): string | null {
    return this.password;
  }

  /**
   * Make authenticated API request
   */
  async authenticatedFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.accessToken}`);

    const response = await fetch(`${this.apiUrl}${path}`, {
      ...options,
      headers,
    });

    // If token expired, try to refresh
    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refreshAccessToken();

        // Retry request with new token
        headers.set('Authorization', `Bearer ${this.accessToken}`);
        return fetch(`${this.apiUrl}${path}`, {
          ...options,
          headers,
        });
      } catch (error) {
        this.clearSession();
        throw new Error('Session expired. Please login again.');
      }
    }

    return response;
  }

  /**
   * Persist session to localStorage
   */
  private persistSession(): void {
    if (this.refreshToken && this.user) {
      localStorage.setItem('auth_refresh_token', this.refreshToken);
      localStorage.setItem('auth_user', JSON.stringify(this.user));
      // Note: password is NOT persisted, only kept in memory
    }
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): void {
    const refreshToken = localStorage.getItem('auth_refresh_token');
    const userJson = localStorage.getItem('auth_user');

    if (refreshToken && userJson) {
      this.refreshToken = refreshToken;
      this.user = JSON.parse(userJson);

      // Try to refresh access token on load
      this.refreshAccessToken().catch(() => {
        this.clearSession();
      });
    }
  }

  /**
   * Clear session
   */
  private clearSession(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.password = null;

    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_user');
  }
}
