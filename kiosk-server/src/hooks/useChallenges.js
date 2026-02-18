import { useMemo } from 'react';
import * as api from '../api/challenges';
import { useCrud } from './useCrud';

export function useChallenges(enabled = true, onUnauthorized = null, profileId = null) {
  const crudApi = useMemo(() => ({
    fetchAll: api.fetchAllChallenges,
    create: api.createChallenge,
    update: api.updateChallenge,
    delete: api.deleteChallenge,
    reorder: api.reorderChallenges,
  }), []);

  const { items, loading, error, fetchAll, create, update, remove, reorder } =
    useCrud(crudApi, { enabled, onUnauthorized, profileId });

  return {
    challenges: items,
    loading,
    error,
    fetchChallenges: fetchAll,
    createChallenge: create,
    updateChallenge: update,
    deleteChallenge: remove,
    reorderChallenges: reorder,
  };
}
