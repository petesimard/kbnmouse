import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/apps';
import { UnauthorizedError } from '../api/apps';

export function useApps(enabled = true, onUnauthorized = null) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    if (err instanceof UnauthorizedError && onUnauthorized) {
      onUnauthorized();
    } else {
      setError(err.message);
    }
  }, [onUnauthorized]);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchAllApps();
      setApps(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    if (enabled) {
      fetchApps();
    }
  }, [fetchApps, enabled]);

  const createApp = useCallback(async (app) => {
    try {
      const newApp = await api.createApp(app);
      setApps((prev) => [...prev, newApp]);
      return newApp;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const updateApp = useCallback(async (id, updates) => {
    try {
      const updated = await api.updateApp(id, updates);
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
      return updated;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const deleteApp = useCallback(async (id) => {
    try {
      await api.deleteApp(id);
      setApps((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const reorderApps = useCallback(async (newOrder) => {
    // Optimistically update the UI
    setApps(newOrder);

    // Build the order array for the API
    const order = newOrder.map((app, index) => ({
      id: app.id,
      sort_order: index,
    }));

    try {
      await api.reorderApps(order);
    } catch (err) {
      // Revert on error
      fetchApps();
      handleError(err);
      throw err;
    }
  }, [fetchApps, handleError]);

  return {
    apps,
    loading,
    error,
    fetchApps,
    createApp,
    updateApp,
    deleteApp,
    reorderApps,
  };
}

export function useBuiltinApps() {
  const [builtinApps, setBuiltinApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchBuiltinApps()
      .then(setBuiltinApps)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { builtinApps, loading };
}
