import { authHeaders, handleResponse, UnauthorizedError } from './client.js';
import { createCrudApi } from './crud.js';

export { UnauthorizedError };

const crud = createCrudApi('/api/admin/challenges');
export const fetchAllChallenges = crud.fetchAll;
export const createChallenge = crud.create;
export const updateChallenge = crud.update;
export const deleteChallenge = crud.delete;
export const reorderChallenges = crud.reorder;

export async function fetchChallengeCompletions(profileId) {
  const url = profileId ? `/api/admin/challenge-completions?profile=${profileId}` : '/api/admin/challenge-completions';
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse(res);
}
