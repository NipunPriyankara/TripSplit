import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { api } from '../api/client.js';
import { localDb } from '../db/db.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, avatar?: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  updateProfile: (data: { name: string; email: string; avatar?: string | null }) => Promise<void>;
  changePassword: (data: { current_password: string; new_password: string }) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = async () => {
    try {
      // First try local cache (IndexedDB)
      const cached = await localDb.cachedUser.get('current');
      if (cached && cached.user) {
        setUser(cached.user);
        setToken(cached.token);
      }

      // Then verify with server if online
      if (api.getToken() && navigator.onLine) {
        const res = await api.getMe();
        setUser(res.user);
      }
    } catch (e) {
      console.warn('Auth check fallback to cached state', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
    setToken(res.token);
  };

  const register = async (name: string, email: string, password: string, avatar?: string) => {
    const res = await api.register(name, email, password, avatar);
    setUser(res.user);
    setToken(res.token);
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
  };

  const refreshMe = async () => {
    if (navigator.onLine) {
      const res = await api.getMe();
      setUser(res.user);
    }
  };

  const updateProfile = async (data: { name: string; email: string; avatar?: string | null }) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
    setToken(res.token);
  };

  const changePassword = async (data: { current_password: string; new_password: string }) => {
    return api.changePassword(data);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshMe, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
