import { useMemo } from 'react';
import * as api from '../api/profiles';
import { useCrud } from './useCrud';

export function useProfiles(enabled = true, onUnauthorized = null) {
  const crudApi = useMemo(() => ({
    fetchAll: api.fetchAllProfiles,
    create: api.createProfile,
    update: api.updateProfile,
    delete: api.deleteProfile,
    reorder: api.reorderProfiles,
  }), []);

  const { items, loading, error, fetchAll, create, update, remove, reorder } =
    useCrud(crudApi, { enabled, onUnauthorized });

  return {
    profiles: items,
    loading,
    error,
    fetchProfiles: fetchAll,
    createProfile: create,
    updateProfile: update,
    deleteProfile: remove,
    reorderProfiles: reorder,
  };
}
