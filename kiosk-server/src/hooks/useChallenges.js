import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/challenges';
import { UnauthorizedError } from '../api/challenges';

export function useChallenges(enabled = true, onUnauthorized = null, profileId = null) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    if (err instanceof UnauthorizedError && onUnauthorized) {
      onUnauthorized();
    } else {
      setError(err.message);
    }
  }, [onUnauthorized]);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchAllChallenges(profileId);
      setChallenges(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError, profileId]);

  useEffect(() => {
    if (enabled) {
      fetchChallenges();
    }
  }, [fetchChallenges, enabled]);

  const createChallenge = useCallback(async (challenge) => {
    try {
      const newChallenge = await api.createChallenge(challenge);
      setChallenges((prev) => [...prev, newChallenge]);
      return newChallenge;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const updateChallenge = useCallback(async (id, updates) => {
    try {
      const updated = await api.updateChallenge(id, updates);
      setChallenges((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const deleteChallenge = useCallback(async (id) => {
    try {
      await api.deleteChallenge(id);
      setChallenges((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const reorderChallenges = useCallback(async (newOrder) => {
    setChallenges(newOrder);

    const order = newOrder.map((challenge, index) => ({
      id: challenge.id,
      sort_order: index,
    }));

    try {
      await api.reorderChallenges(order);
    } catch (err) {
      fetchChallenges();
      handleError(err);
      throw err;
    }
  }, [fetchChallenges, handleError]);

  return {
    challenges,
    loading,
    error,
    fetchChallenges,
    createChallenge,
    updateChallenge,
    deleteChallenge,
    reorderChallenges,
  };
}
