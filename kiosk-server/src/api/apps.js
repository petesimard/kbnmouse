import { authHeaders, handleResponse, UnauthorizedError } from './client.js';

export { UnauthorizedError };

export async function fetchAllApps(profileId) {
  const url = profileId ? `/api/admin/apps?profile=${profileId}` : '/api/admin/apps';
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createApp(app) {
  const res = await fetch('/api/admin/apps', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(app),
  });
  return handleResponse(res);
}

export async function updateApp(id, app) {
  const res = await fetch(`/api/admin/apps/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(app),
  });
  return handleResponse(res);
}

export async function deleteApp(id) {
  const res = await fetch(`/api/admin/apps/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function addBonusTime(minutes, profileId) {
  const res = await fetch('/api/admin/bonus-time', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ minutes, profile_id: profileId || null }),
  });
  return handleResponse(res);
}

export async function reorderApps(order) {
  const res = await fetch('/api/admin/apps/reorder', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ order }),
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
