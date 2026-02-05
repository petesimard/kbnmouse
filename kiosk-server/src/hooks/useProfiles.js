import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/profiles';
import { UnauthorizedError } from '../api/profiles';

export function useProfiles(enabled = true, onUnauthorized = null) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    if (err instanceof UnauthorizedError && onUnauthorized) {
      onUnauthorized();
    } else {
      setError(err.message);
    }
  }, [onUnauthorized]);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchAllProfiles();
      setProfiles(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    if (enabled) {
      fetchProfiles();
    }
  }, [fetchProfiles, enabled]);

  const createProfile = useCallback(async (profile) => {
    try {
      const newProfile = await api.createProfile(profile);
      setProfiles((prev) => [...prev, newProfile]);
      return newProfile;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const updateProfile = useCallback(async (id, updates) => {
    try {
      const updated = await api.updateProfile(id, updates);
      setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const deleteProfile = useCallback(async (id) => {
    try {
      await api.deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const reorderProfiles = useCallback(async (newOrder) => {
    setProfiles(newOrder);

    const order = newOrder.map((profile, index) => ({
      id: profile.id,
      sort_order: index,
    }));

    try {
      await api.reorderProfiles(order);
    } catch (err) {
      fetchProfiles();
      handleError(err);
      throw err;
    }
  }, [fetchProfiles, handleError]);

  return {
    profiles,
    loading,
    error,
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    reorderProfiles,
  };
}
