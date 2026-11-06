'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserDto, UserPersonalizationDto } from '@niva/shared-types';
import { authFetch, setAccessToken } from '@/lib/auth-client';

interface AuthContextType {
  user: UserDto | null;
  personalization: UserPersonalizationDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshPersonalization: () => Promise<UserPersonalizationDto | null>;
  setPersonalizationState: (p: UserPersonalizationDto) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [personalization, setPersonalization] = useState<UserPersonalizationDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refreshPersonalization = useCallback(async (): Promise<UserPersonalizationDto | null> => {
    try {
      const data = await authFetch<UserPersonalizationDto>('/personalization/me');
      setPersonalization(data);
      return data;
    } catch {
      setPersonalization(null);
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      // First try refreshing via the HttpOnly cookie
      const data = await authFetch<{ tokens: { accessToken: string }; user: UserDto }>(
        '/auth/refresh',
        { method: 'POST' },
      );
      if (data?.user) {
        if (data.tokens?.accessToken) {
          setAccessToken(data.tokens.accessToken);
        }
        setUser(data.user);
        // Fetch personalization
        await refreshPersonalization();
      }
    } catch {
      // Not authenticated or refresh token expired
      setUser(null);
      setPersonalization(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshPersonalization]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authFetch<{ tokens: { accessToken: string }; user: UserDto }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      );

      if (data.tokens?.accessToken) {
        setAccessToken(data.tokens.accessToken);
      }
      setUser(data.user);
      const pers = await refreshPersonalization();

      if (pers && !pers.onboardingCompleted) {
        router.push('/onboarding');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authFetch<{ tokens: { accessToken: string }; user: UserDto }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ email, password, name }),
        },
      );

      if (data.tokens?.accessToken) {
        setAccessToken(data.tokens.accessToken);
      }
      setUser(data.user);
      await refreshPersonalization();
      router.push('/onboarding');
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort logout
    } finally {
      setUser(null);
      setPersonalization(null);
      setAccessToken(null);
      setIsLoading(false);
      router.push('/login');
    }
  };

  const setPersonalizationState = (p: UserPersonalizationDto) => {
    setPersonalization(p);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        personalization,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshUser,
        refreshPersonalization,
        setPersonalizationState,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
