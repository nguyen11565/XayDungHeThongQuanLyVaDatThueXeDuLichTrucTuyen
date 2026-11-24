import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const r = await api.get('/notifications/unread-count');
      setUnreadCount(r.data.chuaDoc || 0);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      fetchUnread();
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUnread]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, matKhau) => {
    const res = await api.post('/auth/login', { email, matKhau });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    fetchUnread();
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setUnreadCount(0);
  };

  const hasPerm = (...perms) => {
    if (!user || !Array.isArray(user.permissions)) return false;
    return perms.some((p) => user.permissions.includes(p));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasPerm, unreadCount, fetchUnread }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
