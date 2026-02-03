import { useState, useEffect, useCallback } from 'react';
import { verifyPin as apiVerifyPin, changePin as apiChangePin } from '../api/apps';

const TOKEN_KEY = 'adminToken';

export function usePinAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have a stored token
    const token = localStorage.getItem(TOKEN_KEY);
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  const verifyPin = useCallback(async (pin) => {
    const { token } = await apiVerifyPin(pin);
    localStorage.setItem(TOKEN_KEY, token);
    setIsAuthenticated(true);
    return true;
  }, []);

  const changePin = useCallback(async (currentPin, newPin) => {
    await apiChangePin(currentPin, newPin);
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    loading,
    verifyPin,
    changePin,
    logout,
  };
}
