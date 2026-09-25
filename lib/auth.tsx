import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setAuthToken } from './api';
import { AuthUser } from './types';

const TOKEN_KEY = 'mdss.jwt';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  token: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    username: string;
    password: string;
    title?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Device storage unavailable; token stays in memory for this session only.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const { user: me } = await api.get<{ user: AuthUser }>('/api/auth/me');
    setUser(me);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await readToken();
      if (!stored) {
        setStatus('signedOut');
        return;
      }
      setAuthToken(stored);
      setToken(stored);
      try {
        await refreshUser();
      } catch {
        setAuthToken(null);
        await writeToken(null);
        setToken(null);
        setUser(null);
        setStatus('signedOut');
      }
    })();
  }, [refreshUser]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { identifier, password });
    setAuthToken(result.token);
    await writeToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setStatus('signedIn');
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; username: string; password: string; title?: string }) => {
      const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/register', input);
      setAuthToken(result.token);
      await writeToken(result.token);
      setToken(result.token);
      setUser(result.user);
      setStatus('signedIn');
    },
    []
  );

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await writeToken(null);
    setToken(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, token, signIn, register, signOut, refreshUser }),
    [status, user, token, signIn, register, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
