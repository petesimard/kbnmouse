import { authHeaders, handleResponse, UnauthorizedError } from './client.js';

export { UnauthorizedError };

// Public endpoints
export async function fetchProfiles() {
  const res = await fetch('/api/profiles');
  return res.json();
}

export async function fetchActiveProfile() {
  const res = await fetch('/api/active-profile');
  return res.json();
}

export async function setActiveProfile(profileId) {
  const res = await fetch('/api/active-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: profileId }),
  });
  return res.json();
}

// Admin endpoints
export async function fetchAllProfiles() {
  const res = await fetch('/api/admin/profiles', { headers: authHeaders() });
  return handleResponse(res);
}

export async function createProfile(profile) {
  const res = await fetch('/api/admin/profiles', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(profile),
  });
  return handleResponse(res);
}

export async function updateProfile(id, profile) {
  const res = await fetch(`/api/admin/profiles/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(profile),
  });
  return handleResponse(res);
}

export async function deleteProfile(id) {
  const res = await fetch(`/api/admin/profiles/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function reorderProfiles(order) {
  const res = await fetch('/api/admin/profiles/reorder', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ order }),
  });
  return handleResponse(res);
}
