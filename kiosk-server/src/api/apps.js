import { authHeaders, handleResponse, UnauthorizedError } from './client.js';
import { createCrudApi } from './crud.js';

export { UnauthorizedError };

const crud = createCrudApi('/api/admin/apps');
export const fetchAllApps = crud.fetchAll;
export const createApp = crud.create;
export const updateApp = crud.update;
export const deleteApp = crud.delete;
export const reorderApps = crud.reorder;

export async function addBonusTime(minutes, profileId) {
  const res = await fetch('/api/admin/bonus-time', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ minutes, profile_id: profileId }),
  });
  return handleResponse(res);
}

export async function fetchUsageSummary(profileId) {
  const url = profileId ? `/api/admin/usage-summary?profile=${profileId}` : '/api/admin/usage-summary';
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchSettings() {
  const res = await fetch('/api/admin/settings', { headers: authHeaders() });
  return handleResponse(res);
}

export async function updateSettings(settings) {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  return handleResponse(res);
}
