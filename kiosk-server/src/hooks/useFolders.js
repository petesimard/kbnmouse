import { useMemo } from 'react';
import * as api from '../api/folders';
import { useCrud } from './useCrud';

export function useFolders(enabled = true, onUnauthorized = null, profileId = null) {
  const crudApi = useMemo(() => ({
    fetchAll: api.fetchAllFolders,
    create: api.createFolder,
    update: api.updateFolder,
    delete: api.deleteFolder,
    reorder: api.reorderFolders,
  }), []);

  const { items, loading, error, fetchAll, create, update, remove, reorder } =
    useCrud(crudApi, { enabled, onUnauthorized, profileId });

  return {
    folders: items,
    loading,
    error,
    fetchFolders: fetchAll,
    createFolder: create,
    updateFolder: update,
    deleteFolder: remove,
    reorderFolders: reorder,
  };
}
