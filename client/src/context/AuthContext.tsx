import React, { createContext, useContext, useState, useEffect } from 'react';
import { SelfUserDto, AuthResponseDto, RegisterRequestDto, LoginRequestDto } from '@webchat/shared';

interface AuthContextType {
  currentUser: SelfUserDto | null;
  token: string | null;
  isLoading: boolean;
  login: (data: LoginRequestDto) => Promise<void>;
  register: (data: RegisterRequestDto) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'webchat_token';
const USER_KEY = 'webchat_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<SelfUserDto | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function verifyExistingSession() {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (res.ok) {
          const user: SelfUserDto = await res.json();
          setCurrentUser(user);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Session verification error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    verifyExistingSession();
  }, []);

  const login = async (data: LoginRequestDto) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(err.message || 'Login failed');
    }

    const authRes: AuthResponseDto = await res.json();
    setToken(authRes.token);
    setCurrentUser(authRes.user);
    localStorage.setItem(TOKEN_KEY, authRes.token);
    localStorage.setItem(USER_KEY, JSON.stringify(authRes.user));
  };

  const register = async (data: RegisterRequestDto) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(err.message || 'Registration failed');
    }

    const authRes: AuthResponseDto = await res.json();
    setToken(authRes.token);
    setCurrentUser(authRes.user);
    localStorage.setItem(TOKEN_KEY, authRes.token);
    localStorage.setItem(USER_KEY, JSON.stringify(authRes.user));
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, isLoading, login, register, logout }}>
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
