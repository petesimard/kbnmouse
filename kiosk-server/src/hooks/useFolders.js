import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/folders';
import { UnauthorizedError } from '../api/folders';

export function useFolders(enabled = true, onUnauthorized = null, profileId = null) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    if (err instanceof UnauthorizedError && onUnauthorized) {
      onUnauthorized();
    } else {
      setError(err.message);
    }
  }, [onUnauthorized]);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchAllFolders(profileId);
      setFolders(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError, profileId]);

  useEffect(() => {
    if (enabled) {
      fetchFolders();
    }
  }, [fetchFolders, enabled]);

  const createFolder = useCallback(async (folder) => {
    try {
      const newFolder = await api.createFolder(folder);
      setFolders((prev) => [...prev, newFolder]);
      return newFolder;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const updateFolder = useCallback(async (id, updates) => {
    try {
      const updated = await api.updateFolder(id, updates);
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
      return updated;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const deleteFolder = useCallback(async (id) => {
    try {
      await api.deleteFolder(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const reorderFolders = useCallback(async (newOrder) => {
    setFolders(newOrder);
    const order = newOrder.map((folder, index) => ({
      id: folder.id,
      sort_order: index,
    }));
    try {
      await api.reorderFolders(order);
    } catch (err) {
      fetchFolders();
      handleError(err);
      throw err;
    }
  }, [fetchFolders, handleError]);

  return {
    folders,
    loading,
    error,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
  };
}
