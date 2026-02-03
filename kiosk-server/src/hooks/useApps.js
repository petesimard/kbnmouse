import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/apps';

export function useApps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchAllApps();
      setApps(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const createApp = useCallback(async (app) => {
    const newApp = await api.createApp(app);
    setApps((prev) => [...prev, newApp]);
    return newApp;
  }, []);

  const updateApp = useCallback(async (id, updates) => {
    const updated = await api.updateApp(id, updates);
    setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const deleteApp = useCallback(async (id) => {
    await api.deleteApp(id);
    setApps((prev) => prev.filter((a) => a.id !== id));
  }, []);

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
      throw err;
    }
  }, [fetchApps]);

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
