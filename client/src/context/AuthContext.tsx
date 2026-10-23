import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserDto, AuthResponseDto, RegisterRequestDto, LoginRequestDto } from '@webchat/shared';
import { apiFetch, setUnauthorizedHandler } from '../utils/apiFetch';

interface AuthContextType {
  currentUser: UserDto | null;
  /** True until the startup `GET /api/auth/me` has answered (it can take a while on a cold start). */
  isLoading: boolean;
  login: (data: LoginRequestDto) => Promise<void>;
  register: (data: RegisterRequestDto) => Promise<void>;
  /** Ends the Session on the server, then signs out locally. */
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The Session lives only in the HttpOnly `__Host-session` cookie (ADR 0010): nothing about the
// login is stored in the browser, and who is signed in is always asked of the server.
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Any 401 from the API means the Session is gone: back to the sign-in screen.
  useEffect(() => setUnauthorizedHandler(() => setCurrentUser(null)), []);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentSession() {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!cancelled && res.ok) {
          const { user }: AuthResponseDto = await res.json();
          setCurrentUser(user);
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadCurrentSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const authenticate = async (path: string, data: LoginRequestDto | RegisterRequestDto, fallbackMessage: string) => {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: fallbackMessage }));
      throw new Error(err.message || fallbackMessage);
    }

    const { user }: AuthResponseDto = await res.json();
    setCurrentUser(user);
  };

  const login = (data: LoginRequestDto) => authenticate('/api/auth/login', data, 'Login failed');
  const register = (data: RegisterRequestDto) => authenticate('/api/auth/register', data, 'Registration failed');

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setCurrentUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
