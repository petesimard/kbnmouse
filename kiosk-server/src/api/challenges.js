import { authHeaders, handleResponse, UnauthorizedError } from './client.js';

export { UnauthorizedError };

export async function fetchChallengeCompletions(profileId) {
  const url = profileId ? `/api/admin/challenge-completions?profile=${profileId}` : '/api/admin/challenge-completions';
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchAllChallenges(profileId) {
  const url = profileId ? `/api/admin/challenges?profile=${profileId}` : '/api/admin/challenges';
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createChallenge(challenge) {
  const res = await fetch('/api/admin/challenges', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(challenge),
  });
  return handleResponse(res);
}

export async function updateChallenge(id, challenge) {
  const res = await fetch(`/api/admin/challenges/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(challenge),
  });
  return handleResponse(res);
}

export async function deleteChallenge(id) {
  const res = await fetch(`/api/admin/challenges/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function reorderChallenges(order) {
  const res = await fetch('/api/admin/challenges/reorder', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ order }),
  });
  return handleResponse(res);
}
