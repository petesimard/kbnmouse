import { authHeaders, handleResponse, UnauthorizedError } from './client.js';

export { UnauthorizedError };

export async function fetchFolders(profileId) {
  const url = profileId ? `/api/folders?profile=${profileId}` : '/api/folders';
  const res = await fetch(url);
  return handleResponse(res);
}

export async function fetchAllFolders(profileId) {
  const url = profileId ? `/api/admin/folders?profile=${profileId}` : '/api/admin/folders';
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createFolder(folder) {
  const res = await fetch('/api/admin/folders', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(folder),
  });
  return handleResponse(res);
}

export async function updateFolder(id, folder) {
  const res = await fetch(`/api/admin/folders/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(folder),
  });
  return handleResponse(res);
}

export async function deleteFolder(id) {
  const res = await fetch(`/api/admin/folders/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function reorderFolders(order) {
  const res = await fetch('/api/admin/folders/reorder', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ order }),
  });
  return handleResponse(res);
}
