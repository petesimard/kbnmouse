import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/apps';
import { UnauthorizedError } from '../api/apps';

export function useSettings(enabled = true, onUnauthorized = null) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    if (err instanceof UnauthorizedError && onUnauthorized) {
      onUnauthorized();
    } else {
      setError(err.message);
    }
  }, [onUnauthorized]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchSettings();
      setSettings(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    if (enabled) {
      fetchSettings();
    }
  }, [fetchSettings, enabled]);

  const updateSettings = useCallback(async (updates) => {
    try {
      await api.updateSettings(updates);
      setSettings((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  return {
    settings,
    loading,
    error,
    updateSettings,
  };
}
