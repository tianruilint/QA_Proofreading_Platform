import { useState, useEffect, createContext, useContext } from 'react';
import { apiClient } from '@/lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (apiClient.token) {
        const response = await apiClient.getCurrentUser();
        if (response.success) {
          setUser(response.data.user);
          setIsGuest(false);
        } else {
          apiClient.setToken(null);
          setUser(null);
          setIsGuest(false);
        }
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
      apiClient.setToken(null);
      setUser(null);
      setIsGuest(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userId) => {
    try {
      const response = await apiClient.login(userId);
      if (response.success) {
        setUser(response.data.user);
        setIsGuest(false);
        return { success: true };
      } else {
        return { success: false, error: response.error?.message || '登录失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setUser(null);
      setIsGuest(false);
    }
  };

  const enterGuestMode = () => {
    setUser(null);
    setIsGuest(true);
    apiClient.setToken(null);
  };

  const exitGuestMode = () => {
    setIsGuest(false);
  };

  const value = {
    user,
    loading,
    isGuest,
    isAuthenticated: !!user,
    login,
    logout,
    enterGuestMode,
    exitGuestMode,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
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

