import { authHeaders, handleResponse, UnauthorizedError } from './client.js';
import { createCrudApi } from './crud.js';

export { UnauthorizedError };

const crud = createCrudApi('/api/admin/profiles');
export const fetchAllProfiles = crud.fetchAll;
export const createProfile = crud.create;
export const updateProfile = crud.update;
export const deleteProfile = crud.delete;
export const reorderProfiles = crud.reorder;

export async function fetchProfiles() {
  const res = await fetch('/api/profiles', { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchActiveProfile() {
  const res = await fetch('/api/active-profile', { headers: authHeaders() });
  return handleResponse(res);
}

export async function setActiveProfile(profileId) {
  const res = await fetch('/api/active-profile', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ profile_id: profileId }),
  });
  return handleResponse(res);
}
