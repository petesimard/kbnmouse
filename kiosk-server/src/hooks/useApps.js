import { useMemo } from 'react';
import * as api from '../api/apps';
import { getBuiltinApps } from '../components/builtin';
import { useCrud } from './useCrud';

export function useApps(enabled = true, onUnauthorized = null, profileId = null) {
  const crudApi = useMemo(() => ({
    fetchAll: api.fetchAllApps,
    create: api.createApp,
    update: api.updateApp,
    delete: api.deleteApp,
    reorder: api.reorderApps,
  }), []);

  const { items, loading, error, fetchAll, create, update, remove, reorder } =
    useCrud(crudApi, { enabled, onUnauthorized, profileId });

  return {
    apps: items,
    loading,
    error,
    fetchApps: fetchAll,
    createApp: create,
    updateApp: update,
    deleteApp: remove,
    reorderApps: reorder,
  };
}

export function useBuiltinApps() {
  return { builtinApps: getBuiltinApps(), loading: false };
}
