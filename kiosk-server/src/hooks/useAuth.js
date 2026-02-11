import { useState, useEffect, useCallback } from 'react';
import { getToken, setToken, clearToken } from '../api/client.js';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  requestMagicLink as apiRequestMagicLink,
  requestPasswordReset as apiRequestPasswordReset,
  verifyMagicLink as apiVerifyMagicLink,
  resetPassword as apiResetPassword,
  changePassword as apiChangePassword,
} from '../api/auth.js';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // Check if existing token is valid
        const token = getToken();
        if (token) {
          const res = await fetch('/api/admin/settings', {
            headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            setIsAuthenticated(true);
          } else {
            clearToken();
            setIsAuthenticated(false);
          }
        }
      } catch {
        // Network error — assume not authenticated
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = useCallback(async (email, password) => {
    const { token } = await apiLogin(email, password);
    setToken(token);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (email, password) => {
    const { token } = await apiRegister(email, password);
    setToken(token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore errors on logout
    }
    clearToken();
    setIsAuthenticated(false);
  }, []);

  const handleMagicLinkVerify = useCallback(async (magicToken) => {
    const { token } = await apiVerifyMagicLink(magicToken);
    setToken(token);
    setIsAuthenticated(true);
  }, []);

  const handleResetPassword = useCallback(async (resetToken, password) => {
    const { token } = await apiResetPassword(resetToken, password);
    setToken(token);
    setIsAuthenticated(true);
  }, []);

  return {
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    requestMagicLink: apiRequestMagicLink,
    requestPasswordReset: apiRequestPasswordReset,
    verifyMagicLink: handleMagicLinkVerify,
    resetPassword: handleResetPassword,
    changePassword: apiChangePassword,
  };
}
