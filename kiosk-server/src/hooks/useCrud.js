import { useState, useEffect, useCallback } from 'react';
import { UnauthorizedError } from '../api/client.js';

export function useCrud(api, { enabled = true, onUnauthorized = null, profileId = null } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    if (err instanceof UnauthorizedError && onUnauthorized) {
      onUnauthorized();
    } else {
      setError(err.message);
    }
  }, [onUnauthorized]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchAll(profileId);
      setItems(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError, profileId, api]);

  useEffect(() => {
    if (enabled) {
      fetchAll();
    }
  }, [fetchAll, enabled]);

  const create = useCallback(async (data) => {
    try {
      const newItem = await api.create(data);
      setItems((prev) => [...prev, newItem]);
      return newItem;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError, api]);

  const update = useCallback(async (id, updates) => {
    try {
      const updated = await api.update(id, updates);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError, api]);

  const remove = useCallback(async (id) => {
    try {
      await api.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError, api]);

  const reorder = useCallback(async (newOrder) => {
    setItems(newOrder);
    const order = newOrder.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));
    try {
      await api.reorder(order);
    } catch (err) {
      fetchAll();
      handleError(err);
      throw err;
    }
  }, [fetchAll, handleError, api]);

  return { items, loading, error, fetchAll, create, update, remove, reorder };
}
